import type { Client } from "discord.js";
import { logError } from "../logger";
import { notifyStudentRescheduled } from "../services/coaching-related/reschedule/studentDM";
import { notifyOwnerRescheduled } from "../services/coaching-related/reschedule/ownerDM";
import { updateDiscordEventForReschedule } from "../services/coaching-related/updateDiscordEvent";
import type { SessionPaidSessionPayload } from "./sessionPaidFromWebhook";

export type SessionRescheduledWebhookBody = {
  type: "session_rescheduled";
  previousScheduledStart: string;
  session: SessionPaidSessionPayload;
};

type StepState = { student: boolean; owner: boolean };

/** Dedupe key: same reschedule transition (retries share this). */
const deliveryState = new Map<string, StepState>();
const sessionChains = new Map<string, Promise<void>>();

function normalizeIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new Error("invalid ISO datetime");
  }
  return d.toISOString();
}

function dedupeKey(
  sessionId: string,
  previousISO: string,
  newISO: string
): string {
  return `reschedule:${sessionId}:${previousISO}:${newISO}`;
}

function getState(key: string): StepState {
  let s = deliveryState.get(key);
  if (!s) {
    s = { student: false, owner: false };
    deliveryState.set(key, s);
  }
  return s;
}

function buildReschedulePayload(
  session: SessionPaidSessionPayload,
  previousScheduledStart: string
): {
  discordId: string | null;
  riotTag: string | null;
  sessionType: string;
  scheduledMinutes: number;
  notes: string | null;
  oldStartISO: string | null;
  newStartISO: string;
} {
  const newStartRaw =
    session.scheduledStart ?? session.slotStartISO ?? "";
  if (!newStartRaw) {
    throw new Error("missing session.scheduledStart / slotStartISO for reschedule");
  }

  const newStartISO = normalizeIso(newStartRaw);
  const oldStartISO = normalizeIso(previousScheduledStart);

  const riotTag =
    session.riotTag ?? session.student?.riotTag ?? null;

  return {
    discordId: session.discordId ?? null,
    riotTag,
    sessionType: session.sessionType,
    scheduledMinutes:
      session.scheduledMinutes ?? session.liveMinutes ?? 60,
    notes: session.notes ?? null,
    oldStartISO,
    newStartISO,
  };
}

async function deliverOnce(
  client: Client,
  session: SessionPaidSessionPayload,
  previousScheduledStart: string,
  stateKey: string
): Promise<void> {
  if (session.status && session.status !== "paid") {
    throw new Error(`session.status must be paid for reschedule, got ${session.status}`);
  }

  const payload = buildReschedulePayload(session, previousScheduledStart);
  const state = getState(stateKey);

  if (state.student && state.owner) {
    return;
  }

  if (!payload.discordId) {
    throw new Error("missing session.discordId; cannot DM student");
  }

  if (!state.student) {
    const ok = await notifyStudentRescheduled(client, payload);
    if (!ok) {
      throw new Error("notifyStudentRescheduled failed");
    }
    state.student = true;
  }

  if (!state.owner) {
    const ok = await notifyOwnerRescheduled(client, payload);
    if (!ok) {
      throw new Error("notifyOwnerRescheduled failed");
    }
    state.owner = true;
  }

  void updateDiscordEventForReschedule(client, {
    guildId: process.env.DISCORD_SERVER_ID!,
    stageChannelId: process.env.STAGE_CHANNEL_ID!,
    previousScheduledStart: payload.oldStartISO ?? previousScheduledStart,
    newScheduledStart: payload.newStartISO,
    scheduledMinutes: payload.scheduledMinutes,
  }).catch((err) =>
    logError("deliverSessionRescheduledNotifications updateDiscordEvent", err)
  );
}

/**
 * Sends student + owner reschedule notifications. Retries can complete partial work
 * without duplicate DMs. Concurrent requests for the same dedupe key are serialized.
 */
export async function deliverSessionRescheduledNotifications(
  client: Client,
  session: SessionPaidSessionPayload,
  previousScheduledStart: string
): Promise<void> {
  if (!session.id) {
    throw new Error("missing session id");
  }

  const newRaw = session.scheduledStart ?? session.slotStartISO ?? "";
  if (!newRaw) {
    throw new Error("missing new scheduled time on session");
  }

  let prevNorm: string;
  let newNorm: string;
  try {
    prevNorm = normalizeIso(previousScheduledStart);
    newNorm = normalizeIso(newRaw);
  } catch (err) {
    logError("sessionRescheduledFromWebhook normalize", err);
    throw new Error("invalid previousScheduledStart or session scheduled time");
  }

  const stateKey = dedupeKey(session.id, prevNorm, newNorm);

  const prev = sessionChains.get(stateKey) ?? Promise.resolve();
  const current = prev.then(() =>
    deliverOnce(client, session, previousScheduledStart, stateKey)
  );
  sessionChains.set(stateKey, current);
  try {
    await current;
  } finally {
    if (sessionChains.get(stateKey) === current) {
      sessionChains.delete(stateKey);
    }
  }
}
