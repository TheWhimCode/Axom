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
      await db.query('LISTEN sessions_paid');

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

      // Emit to event listeners
      sessionEvents.emit("sessionPaid", { sessionId });

      // Handle immediately
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

    // Fetch the session
    const res = await db.query(
      `
      SELECT
        id, status, discordId, riotTag, sessionType,
        scheduledStart, scheduledMinutes, notes,
        confirmationSent, bookingOwnerSent
      FROM "Session"
      WHERE id = $1
      `,
      [sessionId]
    );

    const row = res.rows[0];
    if (!row) return;

    if (row.status !== "paid") return; // safety check

    const payload = {
      discordId: row.discordId,
      studentName: null,
      riotTag: row.riotTag,
      scheduledStart: row.scheduledStart,
      scheduledMinutes: row.scheduledMinutes,
      sessionType: row.sessionType,
      notes: row.notes,
    };

    // --------------------------
    // Send student confirmation DM
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
    // Send owner booking DM
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
