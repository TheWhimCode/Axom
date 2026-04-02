import type { Client } from "discord.js";
import { pool } from "../db";
import type { SessionRow } from "../types/session";
import { notifyStudentReminder } from "../services/coaching-related/studentReminderDM";
import { notifyStudentFollowup } from "../services/coaching-related/studentFollowupDM/index";
import { notifyStudent } from "../services/coaching-related/studentConfirmDM";
import { notifyOwner } from "../services/coaching-related/bookingDM";

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
// 3) PAYMENT DMs missed if bot/server was offline
// -------------------------------------------------------
async function checkUnsentPaymentDMs(client: Client) {
  const res = await pool.query<SessionRow>(`
    SELECT
      id,
      "studentId",
      "followups",
      "discordId",
      "riotTag",
      "sessionType",
      ("scheduledStart" AT TIME ZONE 'UTC') AS "scheduledStart",
      "scheduledMinutes",
      "notes",
      "confirmationSent",
      "bookingOwnerSent",
      "champions",
      "league",
      "division"
    FROM "Session"
    WHERE status = 'paid'
      AND ("confirmationSent" = FALSE OR "bookingOwnerSent" = FALSE)
  `);

  const studentIds = [...new Set(res.rows.map((r) => r.studentId).filter(Boolean))] as string[];
  const paidCountByStudent = new Map<string, number>();
  if (studentIds.length > 0) {
    const countRes = await pool.query<{ studentId: string; count: string }>(
      `SELECT "studentId", COUNT(*)::text AS count
       FROM "Session"
       WHERE status = 'paid' AND "studentId" = ANY($1)
       GROUP BY "studentId"`,
      [studentIds]
    );
    for (const r of countRes.rows) {
      paidCountByStudent.set(r.studentId, parseInt(r.count, 10) || 0);
    }
  }

  for (const row of res.rows) {
    const paidCount = row.studentId ? paidCountByStudent.get(row.studentId) ?? 0 : 0;

    const payload = {
      discordId: row.discordId,
      studentName: null,
      riotTag: row.riotTag,
      scheduledStart: row.scheduledStart.toISOString(),
      scheduledMinutes: row.scheduledMinutes,
      sessionType: row.sessionType,
      notes: row.notes ?? null,
      paidCount,
      followups: row.followups ?? 0,
      champions: row.champions ?? null,
      league: row.league ?? null,
      division: row.division ?? null,
    };

    if (row.confirmationSent === false) {
      const claimed = await pool.query(
        `
        UPDATE "Session"
        SET "confirmationSent" = TRUE
        WHERE id = $1 AND "confirmationSent" = FALSE
        RETURNING id
        `,
        [row.id]
      );

      if (claimed.rowCount === 1) {
        const ok = await notifyStudent(client, payload);

        if (!ok) {
          await pool.query(
            `UPDATE "Session" SET "confirmationSent" = FALSE WHERE id = $1`,
            [row.id]
          );
        }
      }
    }

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
  void runTimeChecks(client);

  const FIVE_MINUTES_MS = 5 * 60 * 1000;

  setInterval(() => {
    void runTimeChecks(client);
  }, FIVE_MINUTES_MS);
}