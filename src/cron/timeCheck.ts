import { Pool } from "pg";
import type { Client } from "discord.js";
import { notifyStudentReminder } from "../services/coaching-related/studentReminderDM";
import { notifyStudentFollowup } from "../services/coaching-related/studentFollowupDM";
import { notifyStudent } from "../services/coaching-related/studentConfirmDM";
import { notifyOwner } from "../services/coaching-related/bookingDM";

const pool = new Pool({
  connectionString: process.env.DIRECT_DATABASE_URL!,
  ssl: true,
});

type SessionRow = {
  id: string;
  riotTag: string | null;
  discordId: string | null;
  scheduledStart: Date;
  scheduledMinutes: number;
  sessionType: string;
  reminderSent: boolean;
  followupSent: boolean;
  confirmationSent?: boolean;
  bookingOwnerSent?: boolean;
  notes: string | null;
};

// small helper for spacing messages
function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// -------------------------------------------------------
// 1) REMINDERS — 6h BEFORE (PAID sessions only)
// -------------------------------------------------------
async function checkUpcomingSessions(client: Client) {
  const res = await pool.query<SessionRow>(
    `
      SELECT
        id,
        "riotTag",
        "discordId",
        "scheduledStart",
        "scheduledMinutes",
        "sessionType",
        "reminderSent",
        "followupSent"
      FROM "Session"
      WHERE status = 'paid'
        AND "scheduledStart" BETWEEN NOW() AND NOW() + interval '6 hours'
        AND "reminderSent" = FALSE
    `
  );

  for (const row of res.rows) {
    let studentName: string | null = null;

    if (row.discordId) {
      const user = await client.users.fetch(row.discordId).catch(() => null);
      studentName = user?.globalName ?? null;
    }

    const ok = await notifyStudentReminder(client, {
      studentName,
      discordId: row.discordId,
      scheduledStart: row.scheduledStart.toISOString(), // ← FIXED
      scheduledMinutes: row.scheduledMinutes,
      sessionType: row.sessionType,
    });

    if (ok) {
      await pool.query(
        `UPDATE "Session" SET "reminderSent" = TRUE WHERE id = $1`,
        [row.id]
      );
    }
  }
}

// -------------------------------------------------------
// 2) FOLLOWUPS — 2–48h AFTER (PAID sessions only)
// -------------------------------------------------------
async function checkPastSessions(client: Client) {
  const res = await pool.query<SessionRow>(
    `
      SELECT
        id,
        "riotTag",
        "discordId",
        "scheduledStart",
        "scheduledMinutes",
        "sessionType",
        "reminderSent",
        "followupSent"
      FROM "Session"
      WHERE status = 'paid'
        AND "scheduledStart"
          BETWEEN NOW() - interval '48 hours'
          AND NOW() - interval '2 hours'
        AND "followupSent" = FALSE
    `
  );

  for (const row of res.rows) {
    let studentName: string | null = null;

    if (row.discordId) {
      const user = await client.users.fetch(row.discordId).catch(() => null);
      studentName = user?.globalName ?? null;
    }

    const ok = await notifyStudentFollowup(client, {
      studentName,
      discordId: row.discordId,
      scheduledStart: row.scheduledStart.toISOString(), // ← FIXED
      scheduledMinutes: row.scheduledMinutes,
      sessionType: row.sessionType,
    });

    if (ok) {
      await pool.query(
        `UPDATE "Session" SET "followupSent" = TRUE WHERE id = $1`,
        [row.id]
      );
    }

    // ⭐ rate limit follow-up DMs to 1 per 5 minutes
    await wait(5 * 60 * 1000);
  }
}

// -------------------------------------------------------
// 3) PAYMENT DMs missed if bot/server was offline
// -------------------------------------------------------
async function checkUnsentPaymentDMs(client: Client) {
  const res = await pool.query<SessionRow>(
    `
      SELECT
        id,
        "discordId",
        "riotTag",
        "sessionType",
        "scheduledStart",
        "scheduledMinutes",
        "notes",
        "confirmationSent",
        "bookingOwnerSent"
      FROM "Session"
      WHERE status = 'paid'
        AND ("confirmationSent" = FALSE OR "bookingOwnerSent" = FALSE)
    `
  );

  for (const row of res.rows) {
    const payload = {
      discordId: row.discordId,
      studentName: null,
      riotTag: row.riotTag,
      scheduledStart: row.scheduledStart.toISOString(), // already FIXED
      scheduledMinutes: row.scheduledMinutes,
      sessionType: row.sessionType,
      notes: row.notes ?? null,
    };

    // Send student confirmation if missing
    if (row.confirmationSent === false) {
      const ok = await notifyStudent(client, payload);
      if (ok) {
        await pool.query(
          `UPDATE "Session" SET "confirmationSent" = TRUE WHERE id = $1`,
          [row.id]
        );
      }
    }

    // Send owner DM if missing
    if (row.bookingOwnerSent === false) {
      await notifyOwner(client, payload);
      await pool.query(
        `UPDATE "Session" SET "bookingOwnerSent" = TRUE WHERE id = $1`,
        [row.id]
      );
    }
  }
}

// -------------------------------------------------------

async function runTimeChecks(client: Client) {
  await checkUpcomingSessions(client);
  await checkPastSessions(client);
  await checkUnsentPaymentDMs(client);
}

export function startTimeCheckCron(client: Client) {
  // run once at startup
  void runTimeChecks(client);

  const ONE_HOUR_MS = 60 * 60 * 1000;
  setInterval(() => {
    void runTimeChecks(client);
  }, ONE_HOUR_MS);
}
