// src/services/coaching-related/studentReminderDM.ts
import type { Client } from "discord.js";

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
  const { discordId, scheduledStart, sessionType } = p;

  if (!discordId) return false;

  const user = await client.users.fetch(discordId).catch(() => null);
  if (!user) return false;

  const date =
    scheduledStart instanceof Date
      ? scheduledStart
      : new Date(scheduledStart);

  // Never send reminders for past sessions
  if (date.getTime() <= Date.now()) return false;

  const unix = Math.floor(date.getTime() / 1000);

  const msg = [
    `**I'm back!!** as promised 😎`,
    `Your **${sessionType}** with Sho is coming up soon! 👀`,
    `> Don't forget to join the Discord <t:${unix}:R>`,
    `> https://discord.gg/haZZEEwFNU`,
    `If something came up, please let Sho know ASAP!`,
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
