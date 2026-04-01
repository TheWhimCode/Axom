// src/listener/sessionPaid.ts
import pg from "pg";
import EventEmitter from "events";
import { logError } from "../logger";
import { notifyOwner } from "../services/coaching-related/bookingDM";
import { notifyStudent } from "../services/coaching-related/studentConfirmDM";
import type { Client } from "discord.js";

const DIRECT_DATABASE_URL = process.env.DIRECT_DATABASE_URL!;
const { Client: PgClient } = pg;

export const sessionEvents = new EventEmitter();

/** Serialize NOTIFY handling so bursts can't stack unbounded async DB + Discord work. */
const paidQueue: string[] = [];
let paidQueueRunning = false;

async function enqueueSessionPaid(
  client: Client,
  handleSessionPaid: (sessionId: string) => Promise<void>,
  sessionId: string
) {
  paidQueue.push(sessionId);
  if (paidQueueRunning) return;
  paidQueueRunning = true;
  try {
    while (paidQueue.length > 0) {
      const id = paidQueue.shift()!;
      await handleSessionPaid(id);
      await new Promise((r) => setTimeout(r, 150));
    }
  } finally {
    paidQueueRunning = false;
  }
}

export function startSessionListener(client: Client): () => Promise<void> {
  let db: pg.Client | null = null;
  let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let shuttingDown = false;

  async function connect() {
    if (shuttingDown) return;
    try {
      if (db) {
        try {
          await db.end();
        } catch (e) {
          logError("sessionPaid", e);
        }
      }

      db = new PgClient({ connectionString: DIRECT_DATABASE_URL });
      await db.connect();
      await db.query("LISTEN sessions_paid");

      db.on("notification", onNotification);
      db.on("error", onError);

    } catch (err) {
      logError("sessionPaid connect", err);
      if (!shuttingDown) retry();
    }
  }

  function retry() {
    if (shuttingDown) return;
    retryTimeoutId = setTimeout(connect, 5000);
  }

  async function onNotification(msg: pg.Notification) {
    if (msg.channel !== "sessions_paid" || !msg.payload) return;

    try {
      const { sessionId } = JSON.parse(msg.payload);

      sessionEvents.emit("sessionPaid", { sessionId });

      await enqueueSessionPaid(client, handleSessionPaid, sessionId);
    } catch (err) {
      logError("sessionPaid onNotification", err);
    }
  }

  function onError() {
    if (!shuttingDown) retry();
  }

  connect();

  return async function stop() {
    shuttingDown = true;
    if (retryTimeoutId !== null) {
      clearTimeout(retryTimeoutId);
      retryTimeoutId = null;
    }
    if (db) {
      try {
        await db.end();
      } catch (e) {
        logError("sessionPaid stop", e);
      }
      db = null;
    }
  };

  // ------------------------------
  // MAIN HANDLER
  // ------------------------------
  async function handleSessionPaid(sessionId: string) {
    if (!db) return;

    const res = await db.query(
      `
SELECT
  id,
  status,
  "discordId",
  "studentId",
  "riotTag",
  "sessionType",
  "scheduledStart",
  "scheduledMinutes",
  "notes",
  "followups",
  "confirmationSent",
  "bookingOwnerSent",
  "champions"
FROM "Session"
WHERE id = $1
      `,
      [sessionId]
    );

    const row = res.rows[0];
    if (!row) return;
    if (row.status !== "paid") return;

    // --------------------------
    // Count total paid sessions
    // --------------------------
    let paidCount = 0;

    if (row.studentId) {
      const countRes = await db.query<{ count: number }>(
        `
        SELECT COUNT(*)::int AS count
        FROM "Session"
        WHERE status = 'paid'
          AND "studentId" = $1
        `,
        [row.studentId]
      );

      paidCount = countRes.rows[0]?.count ?? 0;
    }

    const payload = {
      discordId: row.discordId,
      studentName: null,
      riotTag: row.riotTag,
      scheduledStart:
        row.scheduledStart instanceof Date
          ? row.scheduledStart.toISOString()
          : String(row.scheduledStart),
      scheduledMinutes: row.scheduledMinutes,
      sessionType: row.sessionType,
      notes: row.notes,

      paidCount,
      followups: row.followups ?? 0,
      champions: row.champions ?? null,
    };

    // --------------------------
    // Student confirmation DM
    // --------------------------
    const claimed = await db.query(
      `UPDATE "Session"
       SET "confirmationSent" = TRUE
       WHERE id = $1 AND "confirmationSent" = FALSE
       RETURNING id`,
      [sessionId]
    );

    if (claimed.rowCount === 1) {
      const ok = await notifyStudent(client, payload);

      if (!ok) {
        await db.query(
          `UPDATE "Session" SET "confirmationSent" = FALSE WHERE id = $1`,
          [sessionId]
        );
      }
    }

    // --------------------------
    // Owner booking DM
    // --------------------------
    if (!row.bookingOwnerSent) {
      await notifyOwner(client, payload);
      await db.query(
        `UPDATE "Session" SET "bookingOwnerSent" = TRUE WHERE id = $1`,
        [sessionId]
      );
    }
  }
}