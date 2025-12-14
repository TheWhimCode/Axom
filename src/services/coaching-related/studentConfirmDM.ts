// src/services/coaching-related/studentConfirmDM.ts
import type { Client } from "discord.js";
import { DateTime } from "luxon";
import type { BookingPayload } from "./bookingDM";

export async function notifyStudent(
  client: Client,
  p: BookingPayload
): Promise<boolean> {

  const {
    discordId,
    scheduledStart,
    scheduledMinutes,
    sessionType,
  } = p;

  if (!discordId) return false;

  const user = await client.users.fetch(discordId).catch(() => null);
  if (!user) return false;

  // Always use Discord display name now
  const name = user.globalName;

  // scheduledStart is ISO UTC (e.g. 2025-12-14T19:00:00.000Z)
  const dt = DateTime.fromISO(scheduledStart);
  const unix = Math.floor(dt.toSeconds());

  const msg = [
    `> **HEY ${name}!**`,
    `> You just booked a **${sessionType}** with Sho! :partying_face:`,
    ``,
    `Here are some useful details:`,
    `:pencil: **Length:** \`${scheduledMinutes} minutes\``,
    `📅 **Date:** <t:${unix}:D>`,
    `⏰ **Time:** <t:${unix}:t> \`[your timezone]\``,
    ``,
    `I will send you a *little reminder* a few hours before the session! :mage:`,
    `If you have questions at all, please reach out to Sho directly (he doesn't mind).`,
    ``,
    `**We're looking forward to working with you! 🥰**`
  ].join("\n");

  try {
    await user.send(msg);
    return true;
  } catch {
    return false;
  }
}
