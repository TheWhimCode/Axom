// src/services/coaching-related/studentFollowupDM.ts
import type { Client } from "discord.js";
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
  const { studentName, discordId } = p;

  if (!discordId) return false;

  const user = await client.users.fetch(discordId).catch(() => null);
  if (!user) return false;

  // Fetch coupon via Student
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
  if (!coupon) return false;

  const msg = [
    `> **HEY ${studentName || "THERE"}!**`,
    `> How are you feeling after the session? 😊`,
    `It’s totally normal to feel like your head is full of ideas :face_with_spiral_eyes: — just focus on *1–2 things at a time*. That’s how progress actually sticks ✨`,
    ``,
    `**> I can feel it. WinnersQ is up ahead! 📈**`,
    `Sho told me to give you this code — **\`${coupon.code}\`**!`,
    `It gives you **${coupon.value}€** off your next coaching session.`,
    `If a friend uses your code, they also get 5€ off — and your code gets a one-time 5€ upgrade 😱`,
    ``,
    `If you have any thoughts about the session or want to leave a review, just reply **right here** — even a short message is perfect 💌`,
  ].join("\n");

  try {
    await user.send(msg);
    return true;
  } catch {
    return false;
  }
}
