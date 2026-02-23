// src/listener/sessionPaid.ts
import pg from "pg";
import EventEmitter from "events";
import { notifyOwner } from "../services/coaching-related/bookingDM";
import { notifyStudent } from "../services/coaching-related/studentConfirmDM";
import type { Client } from "discord.js";

const DIRECT_DATABASE_URL = process.env.DIRECT_DATABASE_URL!;
const { Client: PgClient } = pg;

export const sessionEvents = new EventEmitter();

export function startSessionListener(client: Client) {
  let db: pg.Client | null = null;

  async function connect() {
    try {
      if (db) {
        try { await db.end(); } catch {}
      }

      db = new PgClient({ connectionString: DIRECT_DATABASE_URL });
      await db.connect();
      await db.query("LISTEN sessions_paid");

      console.log("[PG] sessions_paid listener ready");

      db.on("notification", onNotification);
      db.on("error", onError);

    } catch (err) {
      console.log("[PG] sessions_paid failed, reconnecting…", err);
      retry();
    }
  }

  function retry() {
    setTimeout(connect, 5000);
  }

  async function onNotification(msg: pg.Notification) {
    if (msg.channel !== "sessions_paid" || !msg.payload) return;

    try {
      const { sessionId } = JSON.parse(msg.payload);

      sessionEvents.emit("sessionPaid", { sessionId });

      await handleSessionPaid(sessionId);

    } catch (err) {
      console.log("[PG] bad JSON in sessions_paid", err);
    }
  }

  function onError() {
    console.log("[PG] sessions_paid connection lost, reconnecting…");
    retry();
  }

  connect();

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
  "bookingOwnerSent"
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

    console.log(
      `[SESSION PAID] session=${row.id} discord=${row.discordId} paidCount=${paidCount} followups=${row.followups ?? 0}`
    );

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

      // Context passed cleanly
      paidCount,
      followups: row.followups ?? 0,
    };

    // --------------------------
    // Student confirmation DM
    // --------------------------
    if (!row.confirmationSent) {
      const ok = await notifyStudent(client, payload);
      if (ok) {
        await db.query(
          `UPDATE "Session" SET "confirmationSent" = TRUE WHERE id = $1`,
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