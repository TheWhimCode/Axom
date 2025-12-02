// src/services/coaching-related/studentFollowupDM.ts
import type { Client } from "discord.js";
import { DateTime } from "luxon";
import { parseUTCString } from "../../helper/utcFixer";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DIRECT_DATABASE_URL!,
  ssl: true,
});

export type FollowupPayload = {
  studentName: string | null;
  discordId: string | null;
  scheduledStart: Date | string;
  scheduledMinutes: number;
  sessionType: string;
};

export async function notifyStudentFollowup(
  client: Client,
  p: FollowupPayload
): Promise<boolean> {
  const {
    studentName,
    discordId,
    scheduledStart,
    scheduledMinutes,
    sessionType,
  } = p;

  if (!discordId) return false;

  const user = await client.users.fetch(discordId).catch(() => null);
  if (!user) return false;

  // Correct way to fetch coupon (via Student)
  const couponRes = await pool.query(
    `
      SELECT c.code, c.value
      FROM "Coupon" c
      JOIN "Student" s ON c."studentId" = s.id
      WHERE s."discordId" = $1
      LIMIT 1
    `,
    [discordId]
  );

  const coupon = couponRes.rows[0];

  const dt =
    scheduledStart instanceof Date
      ? DateTime.fromJSDate(scheduledStart).toUTC()
      : parseUTCString(scheduledStart);

  const unix = Math.floor(dt.toSeconds());

  const msg = [
    `> **HEY ${studentName || "THERE"}!**`,
    `> How are you feeling after the session? 😊`,
    `It’s totally normal to feel like your head is full of ideas :face_with_spiral_eyes: — just remember to focus on *1–2 things at a time*. That's how you can actually **feel** that progress and build good habits. :sparkles:`,
    ``,
    `**> I can feel it. WinnsersQ is up ahead! :chart_with_upwards_trend:**`,
    `Sho told me to give you this code — **\`${coupon.code}\`**!`,
    `It gives you **${coupon.value}€** off your next coaching session.`,
    `If a friend uses your code, they also get 5€ off, and your code gets a one-time 5€ upgrade too :scream:`,
    ``,
    `If you have any thoughts about the session or want to leave a review, just reply **right here** — even a short message is great! I’ll pass it along. :love_letter: `,
  ].join("\n");

  try {
    await user.send(msg);
    return true;
  } catch {
    return false;
  }
}
