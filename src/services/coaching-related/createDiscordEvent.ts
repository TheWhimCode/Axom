// src/services/coaching-related/createDiscordEvent.ts
import type { Client } from "discord.js";
import {
  ChannelType,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
} from "discord.js";
import { logError } from "../../logger";

type CreateDiscordEventPayload = {
  guildId: string;
  stageChannelId: string;
  scheduledStart: string; // ISO
  scheduledMinutes: number;
  sessionType: string;

  // optional extra info for title/description (currently unused)
  studentName?: string | null;
  riotTag?: string | null;
  champions?: string[] | null;
};

export async function createDiscordEvent(
  client: Client,
  p: CreateDiscordEventPayload
): Promise<boolean> {
  const guild = await client.guilds.fetch(p.guildId).catch(() => null);
  if (!guild) {
    return false;
  }

  const ch = await guild.channels.fetch(p.stageChannelId).catch(() => null);
  if (!ch) {
    return false;
  }

  if (ch.type !== ChannelType.GuildStageVoice && ch.type !== ChannelType.GuildVoice) {
    // intentionally silent
  }

  const start = new Date(p.scheduledStart);
  if (Number.isNaN(start.getTime())) {
    return false;
  }

  const end = new Date(start.getTime() + p.scheduledMinutes * 60_000);

  const championsPart =
    p.champions && p.champions.length > 0
      ? " " + p.champions.join(" & ")
      : "";
  const title = `Coaching:${championsPart}`;
  const description = [
    `This is a scheduled coaching session with Sho :boom:`,
    `**You're welcome to join, listen, and learn from the session in real time.**`,
    ``,
    `If you have questions while watching, write them in the Stage channel chat.`,
    `Sho will answer them after the session ends.`,
    ``,
    `Enjoy the session and take notes 📒`,
  ].join("\n");

  try {
    await guild.scheduledEvents.create({
      name: title,
      description,
      scheduledStartTime: start,
      scheduledEndTime: end,
      privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
      entityType: GuildScheduledEventEntityType.StageInstance,
      channel: p.stageChannelId,
    });

    return true;
  } catch (err) {
    logError("createDiscordEvent", err);
    return false;
  }
}