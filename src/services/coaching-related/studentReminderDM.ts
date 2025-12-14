// src/services/coaching-related/studentReminderDM.ts
import type { Client } from "discord.js";
import { DateTime } from "luxon";

export type ReminderPayload = {
  studentName: string | null;
  discordId: string | null;
  scheduledStart: Date | string;
  scheduledMinutes: number;
  sessionType: string;
};

export async function notifyStudentReminder(
  client: Client,
  p: ReminderPayload
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

  // scheduledStart is either:
  // - JS Date (already absolute)
  // - ISO UTC string (e.g. 2025-12-14T19:00:00.000Z)
  const dt =
    scheduledStart instanceof Date
      ? DateTime.fromJSDate(scheduledStart)
      : DateTime.fromISO(scheduledStart);

  // Never send if already in the past
  if (dt < DateTime.utc()) return false;

  const unix = Math.floor(dt.toSeconds());

  const msg = [
    `**I'm back!!** as promised 😎`,
    `Your **${sessionType}** with Sho is coming up soon! 👀`,
    `> Don't forget to join the Discord <t:${unix}:R>`,
    `> https://discord.gg/haZZEEwFNU`,
    `In case something came up, please let Sho know ASAP!!`,
    ``,
    `**See you soon!** <:Challenger:1378748820090917095>`,
  ].join("\n");

  try {
    await user.send(msg);
    return true;
  } catch {
    return false;
  }
}
