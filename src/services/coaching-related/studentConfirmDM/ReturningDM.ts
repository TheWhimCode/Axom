import type { Client } from "discord.js";
import { DateTime } from "luxon";
import { logError } from "../../../logger";
import type { StudentConfirmPayload } from "./index";

export async function sendReturningDM(
  client: Client,
  p: StudentConfirmPayload
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

  const name = user.globalName ?? "Champion";

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
    `As always, I will send you a *little reminder* a few hours before the session! :mage:`,
  ].join("\n");

  try {
    await user.send(msg);
    return true;
  } catch (err) {
    logError("studentConfirmDM Returning", err);
    return false;
  }
}