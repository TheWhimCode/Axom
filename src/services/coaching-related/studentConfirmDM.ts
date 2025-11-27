import type { Client } from "discord.js";
import { DateTime } from "luxon";
import type { BookingPayload } from "./bookingDM";

export async function notifyStudent(
  client: Client,
  p: BookingPayload
): Promise<boolean> {

  const {
    studentName,
    studentDiscord,
    riotTag,
    scheduledStart,
    scheduledMinutes,
    sessionType,
  } = p;

  if (!studentDiscord) return false;

  const user = await client.users.fetch(studentDiscord).catch(() => null);
  if (!user) return false;

  const dt = DateTime.fromISO(scheduledStart, { zone: "Europe/Berlin" });
  const date = dt.toFormat("dd LLL yyyy");
  const time = dt.toFormat("HH:mm");

  const msg = [
    `Hey ${studentName || "there"}! 👋`,
    ``,
    `Your **${sessionType === "Custom Session" ? `${scheduledMinutes}min Custom Session` : sessionType}** is booked!`,
    ``,
    `📅 **Date:** ${date}`,
    `⏰ **Time:** ${time} (Berlin)`,
    riotTag ? `🎮 **Riot:** ${riotTag}` : ``,
    ``,
    `If you have questions before the session, feel free to DM me here!`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await user.send(msg);
    return true;
  } catch {
    return false;
  }
}
