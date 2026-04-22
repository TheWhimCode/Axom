import type { Client } from "discord.js";
import { pool } from "../db";
import type { SessionRow } from "../types/session";
import { notifyStudentReminder } from "../services/coaching-related/studentReminderDM";
import { notifyStudentFollowup } from "../services/coaching-related/studentFollowupDM/index";
import { notifySpeedReviewReminder } from "../services/coaching-related/speedReviewReminderDM";
import { logError } from "../logger";

const OWNER_ID = process.env.OWNER_ID!;

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

type SpeedReviewQueueRow = {
  id: string;
  discordId: string;
};

type SpeedReviewConfigRow = {
  nextSessionAt: Date | null;
};

async function checkSpeedReview24hReminders(client: Client) {
  const configRes = await pool.query<SpeedReviewConfigRow>(`
    SELECT "nextSessionAt"
    FROM "SpeedReviewConfig"
    WHERE id = 'default'
      AND "reminder24hSent" = FALSE
      AND "nextSessionAt" IS NOT NULL
      AND ("nextSessionAt" AT TIME ZONE 'UTC')
            BETWEEN NOW() AND NOW() + interval '24 hours'
    LIMIT 1
  `);

  const nextSessionAt = configRes.rows[0]?.nextSessionAt ?? null;
  if (!nextSessionAt) {
    return;
  }

  const queueRes = await pool.query<SpeedReviewQueueRow>(`
    SELECT id, "discordId"
    FROM "SpeedReviewQueue"
    WHERE "reviewStatus" = 'Pending'
      AND COALESCE("optOut", FALSE) = FALSE
    ORDER BY "previousReviews" ASC, "queueDate" ASC
    LIMIT 200
  `);

  let sentAny = false;
  for (let idx = 0; idx < queueRes.rows.length; idx += 1) {
    const row = queueRes.rows[idx];
    if (!row) continue;

    const ok = await notifySpeedReviewReminder(client, {
      discordId: row.discordId,
      queueEntryId: row.id,
      position: idx + 1,
      nextSessionAt,
    });

    if (!ok) {
      logError(
        "checkSpeedReview24hReminders",
        new Error(`failed to DM queue row ${row.id}`)
      );
      continue;
    }

    sentAny = true;
  }

  if (!sentAny && queueRes.rows.length > 0) {
    return;
  }

  await pool.query(
    `
      UPDATE "SpeedReviewConfig"
      SET "reminder24hSent" = TRUE
      WHERE id = 'default'
        AND "reminder24hSent" = FALSE
    `
  );
}

// Payment confirmation DMs are triggered by sho-coaching via HTTP webhook (not this cron).
// -------------------------------------------------------

async function runTimeChecks(client: Client) {
  await checkSpeedReview24hReminders(client).catch((err) =>
    logError("runTimeChecks speedReview24h", err)
  );
  await checkUpcomingSessions(client).catch((err) =>
    logError("runTimeChecks upcoming", err)
  );
  await checkPastSessions(client).catch((err) =>
    logError("runTimeChecks past", err)
  );
}

async function sendSpeedReviewVariantStartupTest(client: Client) {
  const nextSessionAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const testPositions = [2, 6, 12];

  for (const position of testPositions) {
    const ok = await notifySpeedReviewReminder(client, {
      discordId: OWNER_ID,
      queueEntryId: `startup-test-${position}`,
      position,
      nextSessionAt,
    });
    if (!ok) {
      logError(
        "sendSpeedReviewVariantStartupTest",
        new Error(`failed to send startup variant for position ${position}`)
      );
    }
  }
}

export function startTimeCheckCron(client: Client) {
  void sendSpeedReviewVariantStartupTest(client).catch((err) =>
    logError("startTimeCheckCron startup speed review test", err)
  );
  void runTimeChecks(client);

  const ONE_HOUR_MS = 60 * 60 * 1000;

  setInterval(() => {
    void runTimeChecks(client);
  }, ONE_HOUR_MS);
}
