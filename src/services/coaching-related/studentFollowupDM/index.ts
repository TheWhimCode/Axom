// src/services/coaching-related/studentFollowupDM/index.ts
import type { Client } from "discord.js";
import { Pool } from "pg";
import { sendDefaultFollowupDM } from "./DefaultDM";
import { sendReturningFollowupDM } from "./ReturningDM";

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

  // IMPORTANT: pass this in from the caller (cron) just like your confirmation flow
  paidCount?: number;
  followups?: number;
};

type MainDMKind = "default" | "returning";

function pickMainDMKind(p: FollowupPayload): MainDMKind {
  const n = Number(p.paidCount ?? 0);
  return n > 1 ? "returning" : "default";
}

export async function notifyStudentFollowup(
  client: Client,
  p: FollowupPayload
): Promise<boolean> {
  const { discordId } = p;
  if (!discordId) return false;

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

  const kind = pickMainDMKind(p);

  const opts = {
    couponCode: String(coupon.code),
    couponValue: Number(coupon.value),
  };

  return kind === "returning"
    ? await sendReturningFollowupDM(client, p, opts)
    : await sendDefaultFollowupDM(client, p, opts);
}