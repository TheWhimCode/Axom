// src/listener/sessionRescheduled.ts
import pg from "pg";
import type { Client } from "discord.js";
import { notifyStudentRescheduled } from "../services/coaching-related/reschedule/studentDM";
import { notifyOwnerRescheduled } from "../services/coaching-related/reschedule/ownerDM";

const DIRECT_DATABASE_URL = process.env.DIRECT_DATABASE_URL!;
const { Client: PgClient } = pg;

type RescheduleNotifyPayload = {
  id?: string;
  sessionId?: string;
  oldStart?: string;
  newStart?: string;
};

export function startSessionRescheduledListener(client: Client) {
  let db: pg.Client | null = null;

  async function connect() {
    try {
      if (db) {
        try {
          await db.end();
        } catch {}
      }

      db = new PgClient({ connectionString: DIRECT_DATABASE_URL });
      await db.connect();
      await db.query("LISTEN sessions_rescheduled");

      console.log("[PG] sessions_rescheduled listener ready");

      db.on("notification", onNotification);
      db.on("error", onError);
    } catch (err) {
      console.log("[PG] sessions_rescheduled failed, reconnecting…", err);
      retry();
    }
  }

  function retry() {
    setTimeout(connect, 5000);
  }

  async function onNotification(msg: pg.Notification) {
    if (msg.channel !== "sessions_rescheduled" || !msg.payload) return;

    let payload: RescheduleNotifyPayload;
    try {
      payload = JSON.parse(msg.payload);
    } catch (err) {
      console.log("[PG] bad JSON in sessions_rescheduled", err);
      return;
    }

    // Support both payload styles: { sessionId } or { id }
    const sessionId = payload.sessionId ?? payload.id;
    const oldStart = payload.oldStart ?? null;
    const newStart = payload.newStart ?? null;

    if (!sessionId) {
      console.log(
        "[PG] sessions_rescheduled missing id/sessionId payload:",
        msg.payload
      );
      return;
    }

    try {
      // Fetch what we need to DM
      const res = await db!.query(
        `
        SELECT
          id, status, "discordId", "riotTag", "sessionType",
          "scheduledStart", "scheduledMinutes", notes
        FROM "Session"
        WHERE id = $1
        `,
        [sessionId]
      );

      const row = res.rows[0];
      if (!row) return;

      // Only DM for paid sessions (keep consistent with your other flows)
      if (row.status !== "paid") return;

      // Normalize to UTC ISO (with Z) no matter what the trigger sent.
      // If trigger sent ISO with Z already, this stays correct.
      // If trigger sent a timezone-less timestamp, Date parsing can be inconsistent,
      // so we fall back to DB value for newStart when needed.
      const oldStartISO = oldStart ? new Date(oldStart).toISOString() : null;
      const newStartISO = newStart
        ? new Date(newStart).toISOString()
        : new Date(row.scheduledStart).toISOString();

      const dmPayload = {
        discordId: (row.discordId as string | null) ?? null,
        riotTag: (row.riotTag as string | null) ?? null,
        sessionType: row.sessionType as string,
        scheduledMinutes: row.scheduledMinutes as number,
        notes: (row.notes as string | null) ?? null,
        oldStartISO,
        newStartISO,
      };

      await notifyStudentRescheduled(client, dmPayload);
      await notifyOwnerRescheduled(client, dmPayload);
    } catch (err) {
      console.log("[PG] sessions_rescheduled handler error", err);
    }
  }

  function onError() {
    console.log("[PG] sessions_rescheduled connection lost, reconnecting…");
    retry();
  }

  connect();
}
