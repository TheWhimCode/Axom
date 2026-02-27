import type { Client } from "discord.js";
import { DateTime } from "luxon";
import type { StudentConfirmPayload } from "./index";

export async function sendDefaultDM(
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
    `:studio_microphone: **How sessions work**`,
    `Most sessions are held in a Discord **Stage Channel** :satellite:,`,
    `so others can quietly watch and learn from them.`,
    `You'll be the only one talking with Sho!! — viewers can't interrupt.`,
    ``,
    `If you'd prefer a completely private session instead,`,
    `just reply here with **"no public session"** — no worries at all.`,
    ``,
    `I will send you a *little reminder* a few hours before the session! :mage:`,
    `If you have questions at all, please reach out to Sho directly (he doesn't mind).`,
  ].join("\n");

  try {
    await user.send(msg);
    return true;
  } catch {
    return false;
  }
}