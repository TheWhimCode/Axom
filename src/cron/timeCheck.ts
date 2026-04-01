import type { Client } from "discord.js";
import { pool } from "../db";
import type { SessionRow } from "../types/session";
import { notifyStudentReminder } from "../services/coaching-related/studentReminderDM";
import { notifyStudentFollowup } from "../services/coaching-related/studentFollowupDM/index";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// -------------------------------------------------------
// 1) REMINDERS — 6h BEFORE (PAID sessions only)
// -------------------------------------------------------
async function checkUpcomingSessions(client: Client) {
  const res = await pool.query<SessionRow>(`
    SELECT
      id,
      "studentId",
      "followups",
      "riotTag",
      "discordId",
      ("scheduledStart" AT TIME ZONE 'UTC') AS "scheduledStart",
      "scheduledMinutes",
      "sessionType",
      "reminderSent",
      "followupSent"
    FROM "Session"
    WHERE status = 'paid'
      AND ("scheduledStart" AT TIME ZONE 'UTC')
            BETWEEN NOW() AND NOW() + interval '6 hours'
      AND "reminderSent" = FALSE
    ORDER BY "scheduledStart" ASC
    LIMIT 80
  `);

  for (const row of res.rows) {
    let studentName: string | null = null;

    if (row.discordId) {
      const user = await client.users.fetch(row.discordId).catch(() => null);
      studentName = user?.globalName ?? null;
    }

    const ok = await notifyStudentReminder(client, {
      studentName,
      discordId: row.discordId,
      scheduledStart: row.scheduledStart.toISOString(),
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
  const res = await pool.query<SessionRow>(`
    SELECT
      id,
      "studentId",
      "followups",
      "riotTag",
      "discordId",
      ("scheduledStart" AT TIME ZONE 'UTC') AS "scheduledStart",
      "scheduledMinutes",
      "sessionType",
      "reminderSent",
      "followupSent"
    FROM "Session"
    WHERE status = 'paid'
      AND ("scheduledStart" AT TIME ZONE 'UTC')
            BETWEEN NOW() - interval '48 hours'
                AND NOW() - interval '2 hours'
      AND "followupSent" = FALSE
    ORDER BY "scheduledStart" ASC
    LIMIT 40
  `);

  for (const row of res.rows) {
    let studentName: string | null = null;

    if (row.discordId) {
      const user = await client.users.fetch(row.discordId).catch(() => null);
      studentName = user?.globalName ?? null;
    }

    const ok = await notifyStudentFollowup(client, {
      studentName,
      discordId: row.discordId,
      scheduledStart: row.scheduledStart.toISOString(),
      scheduledMinutes: row.scheduledMinutes,
      sessionType: row.sessionType,
    });

    if (ok) {
      await pool.query(
        `UPDATE "Session" SET "followupSent" = TRUE WHERE id = $1`,
        [row.id]
      );
    }

    await wait(5 * 60 * 1000);
  }
}

// -------------------------------------------------------
// Payment confirmation DMs are triggered by sho-coaching via HTTP webhook.
// -------------------------------------------------------

async function runTimeChecks(client: Client) {
  await checkUpcomingSessions(client);
  await checkPastSessions(client);
}

export function startTimeCheckCron(client: Client) {
  void runTimeChecks(client);

  const ONE_HOUR_MS = 60 * 60 * 1000;

  setInterval(() => {
    void runTimeChecks(client);
  }, ONE_HOUR_MS);
}
