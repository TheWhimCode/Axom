// src/services/coaching-related/studentConfirmDM.ts
import type { Client } from "discord.js";
import { DateTime } from "luxon";
import type { BookingPayload } from "./bookingDM";

export async function notifyStudent(
  client: Client,
  p: BookingPayload
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

  // Convert to unix timestamp (UTC-safe)
  const unix = Math.floor(DateTime.fromISO(scheduledStart).toSeconds());

  const msg = [
    `> **HEY ${studentName || "THERE"}!**`,
    `> You just booked a **${sessionType}** with Sho! :partying_face:`,
    ``,
    `Here are some useful details:`,
    `:pencil: **Info:** \`${scheduledMinutes} minutes\``,
    `📅 **Date:** <t:${unix}:D>`,
    `⏰ **Time:** <t:${unix}:t> \`[your timezone]\``,
    ``,
    `I will send you a little reminder a few hours before the session! :mage:`,
    `If you have questions at all, please reach out to Sho directly (he doesn't mind).`,
    ``,
    `**We're looking forward to working with you!** 🥰`
  ].join("\n");

  try {
    await user.send(msg);
    return true;
  } catch {
    return false;
  }
}
