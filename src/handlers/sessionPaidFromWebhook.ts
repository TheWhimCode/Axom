import type { Client } from "discord.js";
import { pool } from "../db";
import { logError } from "../logger";
import { notifyOwner } from "../services/coaching-related/bookingDM";
import {
  notifyStudent,
  type StudentConfirmPayload,
} from "../services/coaching-related/studentConfirmDM";

/**
 * Inner `session` object from sho-coaching webhooks (not the full HTTP body).
 * Top-level envelope: { type, session, rank? }.
 */
export type SessionPaidSessionPayload = {
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
    puuid?: string | null;
    server?: string | null;
  };
  slotId?: string;
  slotStartISO?: string;
  /** Only if sho-coaching adds them to webhook select later */
  notes?: string | null;
  /** Array of champion names, or JSON string, or single `champion` */
  champions?: string[] | string | null;
  champion?: string | null;
  /** Legacy flat rank; prefer top-level `rank` on the webhook body */
  league?: string | null;
  division?: string | null;
  /** If omitted, we may query the DB by studentId or default to 1. */
  paidCount?: number;
  paidSessionCount?: number;
};

/** Top-level `rank` next to `session` (tier + division from ranked API). */
export type SessionPaidRankPayload = {
  league?: string | null;
  division?: string | null;
  platform?: string | null;
};

/** @deprecated Use SessionPaidSessionPayload */
export type WebhookSessionPaidBody = SessionPaidSessionPayload;

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

async function resolvePaidCount(session: SessionPaidSessionPayload): Promise<number> {
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

/** Normalize champions from webhook + DB when payload omits or uses alternate shapes. */
async function resolveChampions(
  session: SessionPaidSessionPayload
): Promise<string[] | null> {
  const raw = session.champions;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((c) => String(c).trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((c) => String(c).trim()).filter(Boolean);
      }
    } catch {
      /* not JSON — single name */
    }
    return [raw.trim()];
  }
  const single = session.champion?.trim();
  if (single) return [single];

  if (session.id) {
    try {
      const r = await pool.query<{ champions: unknown }>(
        `SELECT "champions" FROM "Session" WHERE id = $1 LIMIT 1`,
        [session.id]
      );
      const row = r.rows[0];
      const c = row?.champions;
      if (Array.isArray(c) && c.length > 0) {
        return c.map((x) => String(x).trim()).filter(Boolean);
      }
      if (typeof c === "string" && c.trim()) {
        try {
          const p = JSON.parse(c) as unknown;
          if (Array.isArray(p) && p.length > 0) {
            return p.map((x) => String(x).trim()).filter(Boolean);
          }
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      logError("resolveChampions Session lookup", err);
    }
  }

  return null;
}

function buildStudentPayload(
  session: SessionPaidSessionPayload,
  paidCount: number,
  rank: SessionPaidRankPayload | null | undefined,
  championsResolved: string[] | null
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

  const league =
    rank?.league ?? session.league ?? null;
  const division =
    rank?.division ?? session.division ?? null;

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
    champions: championsResolved,
    league,
    division,
  };
}

async function deliverOnce(
  client: Client,
  session: SessionPaidSessionPayload,
  rank: SessionPaidRankPayload | null | undefined
): Promise<void> {
  const sessionId = session.id;

  const state = getState(sessionId);
  if (state.student && state.owner) {
    return;
  }

  const paidCount = await resolvePaidCount(session);
  const championsResolved = await resolveChampions(session);
  const payload = buildStudentPayload(session, paidCount, rank, championsResolved);

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
  session: SessionPaidSessionPayload,
  rank?: SessionPaidRankPayload | null
): Promise<void> {
  const sessionId = session.id;
  if (!sessionId) {
    throw new Error("missing session id");
  }

  const prev = sessionChains.get(sessionId) ?? Promise.resolve();
  const current = prev
    .then(() => deliverOnce(client, session, rank))
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
