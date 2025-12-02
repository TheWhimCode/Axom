// src/cron/timeCheck.ts
import { Pool } from "pg";
import type { Client } from "discord.js";
import { notifyStudentReminder } from "../services/coaching-related/studentReminderDM";
import { notifyStudentFollowup } from "../services/coaching-related/studentFollowupDM";

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
};

// small helper for spacing messages
function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 6h BEFORE sessions
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
      WHERE "scheduledStart" BETWEEN NOW() AND NOW() + interval '6 hours'
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
      scheduledStart: row.scheduledStart,
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

// 2-48h AFTER sessions
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
      WHERE "scheduledStart"
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
      scheduledStart: row.scheduledStart,
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

async function runTimeChecks(client: Client) {
  await checkUpcomingSessions(client);
  await checkPastSessions(client);
}

export function startTimeCheckCron(client: Client) {
  // run once at startup
  void runTimeChecks(client);

  const ONE_HOUR_MS = 60 * 60 * 1000;
  setInterval(() => {
    void runTimeChecks(client);
  }, ONE_HOUR_MS);
}
