// src/services/coaching-related/studentRescheduledDM.ts
import type { Client } from "discord.js";
import { DateTime } from "luxon";
import { logError } from "../../../logger";

export interface RescheduledPayload {
  discordId: string | null;
  riotTag: string | null;
  sessionType: string;
  scheduledMinutes: number;
  notes: string | null;
  oldStartISO: string | null; // UTC ISO
  newStartISO: string;        // UTC ISO
}

export async function notifyStudentRescheduled(
  client: Client,
  p: RescheduledPayload
): Promise<boolean> {
  const { discordId, sessionType, scheduledMinutes, oldStartISO, newStartISO } = p;

  if (!discordId) return false;

  const user = await client.users.fetch(discordId).catch(() => null);
  if (!user) return false;

  // Always use Discord display name
  const name = user.globalName;

  const newDt = DateTime.fromISO(newStartISO);
  const newUnix = Math.floor(newDt.toSeconds());

  const oldUnix =
    oldStartISO ? Math.floor(DateTime.fromISO(oldStartISO).toSeconds()) : null;

  const msg = [
    `> **HEY ${name}!**`,
    `> Small update: your **${sessionType}** with Sho got **rescheduled** :calendar_spiral:`,
    ``,
    `Here’s the new time:`,
    `📅 **Date:** <t:${newUnix}:D>`,
    `⏰ **Time:** <t:${newUnix}:t> \`[your timezone]\``,
    ``,
        ``,
    `**See you then!** :partying_face:`,
  ].join("\n");

  try {
    await user.send(msg);
    return true;
  } catch (err) {
    logError("reschedule studentDM", err);
    return false;
  }
}
