import type { Client } from "discord.js";
import { pool } from "../db";
import { logError } from "../logger";
import { notifyOwner } from "../services/coaching-related/bookingDM";
import {
  notifyStudent,
  type StudentConfirmPayload,
} from "../services/coaching-related/studentConfirmDM";

/** Payload shape from sho-coaching (fields may grow). */
export type WebhookSessionPaidBody = {
  id: string;
  status?: string;
  sessionType: string;
  liveMinutes?: number;
  followups?: number;
  liveBlocks?: unknown;
  riotTag?: string | null;
  discordId?: string | null;
  discordName?: string | null;
  scheduledStart?: string;
  scheduledMinutes?: number;
  paymentRef?: string;
  paymentProvider?: string;
  amountCents?: number;
  currency?: string;
  studentId?: string | null;
  student?: {
    name?: string | null;
    discordName?: string | null;
    riotTag?: string | null;
  };
  slotId?: string;
  slotStartISO?: string;
  notes?: string | null;
  champions?: string[] | null;
  league?: string | null;
  division?: string | null;
  /** If omitted, we may query the DB by studentId or default to 1. */
  paidCount?: number;
  paidSessionCount?: number;
};

type StepState = { student: boolean; owner: boolean };

const deliveryState = new Map<string, StepState>();
/** Serialize concurrent webhooks for the same session id. */
const sessionChains = new Map<string, Promise<void>>();

function getState(sessionId: string): StepState {
  let s = deliveryState.get(sessionId);
  if (!s) {
    s = { student: false, owner: false };
    deliveryState.set(sessionId, s);
  }
  return s;
}

async function resolvePaidCount(session: WebhookSessionPaidBody): Promise<number> {
  const direct =
    session.paidCount ?? session.paidSessionCount ?? undefined;
  if (typeof direct === "number" && Number.isFinite(direct)) {
    return Math.max(0, Math.floor(direct));
  }

  if (session.studentId) {
    try {
      const countRes = await pool.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM "Session"
        WHERE status = 'paid' AND "studentId" = $1
        `,
        [session.studentId]
      );
      const n = parseInt(countRes.rows[0]?.count ?? "0", 10);
      if (Number.isFinite(n)) return n;
    } catch (err) {
      logError("sessionPaidFromWebhook paidCount query", err);
    }
  }

  return 1;
}

function buildStudentPayload(
  session: WebhookSessionPaidBody,
  paidCount: number
): StudentConfirmPayload {
  const scheduledStart =
    session.scheduledStart ?? session.slotStartISO ?? "";
  const scheduledMinutes =
    session.scheduledMinutes ?? session.liveMinutes ?? 60;

  const riotTag =
    session.riotTag ?? session.student?.riotTag ?? null;

  const studentName =
    session.student?.name ??
    session.discordName ??
    session.student?.discordName ??
    null;

  return {
    discordId: session.discordId ?? null,
    studentName,
    riotTag,
    scheduledStart,
    scheduledMinutes,
    sessionType: session.sessionType,
    notes: session.notes ?? null,
    paidCount,
    followups: session.followups ?? 0,
    champions: session.champions ?? null,
    league: session.league ?? null,
    division: session.division ?? null,
  };
}

async function deliverOnce(
  client: Client,
  session: WebhookSessionPaidBody
): Promise<void> {
  const sessionId = session.id;

  const state = getState(sessionId);
  if (state.student && state.owner) {
    return;
  }

  const paidCount = await resolvePaidCount(session);
  const payload = buildStudentPayload(session, paidCount);

  if (!payload.discordId) {
    throw new Error("missing session.discordId; cannot DM student");
  }

  if (!payload.scheduledStart) {
    throw new Error("missing scheduledStart / slotStartISO");
  }

  if (!state.student) {
    const ok = await notifyStudent(client, payload);
    if (!ok) {
      throw new Error("notifyStudent failed");
    }
    state.student = true;
  }

  if (!state.owner) {
    const ok = await notifyOwner(client, payload);
    if (!ok) {
      throw new Error("notifyOwner failed");
    }
    state.owner = true;
  }
}

/**
 * Sends student + owner booking notifications for a paid session.
 * Tracks per-step success so retries can complete without duplicate student DMs.
 * Concurrent requests for the same session id are serialized.
 */
export async function deliverSessionPaidNotifications(
  client: Client,
  session: WebhookSessionPaidBody
): Promise<void> {
  const sessionId = session.id;
  if (!sessionId) {
    throw new Error("missing session id");
  }

  const prev = sessionChains.get(sessionId) ?? Promise.resolve();
  const current = prev
    .then(() => deliverOnce(client, session))
    .catch((err) => {
      throw err;
    });
  sessionChains.set(sessionId, current);
  try {
    await current;
  } finally {
    if (sessionChains.get(sessionId) === current) {
      sessionChains.delete(sessionId);
    }
  }
}
