import type { Client, GuildScheduledEvent } from "discord.js";
import { ChannelType, GuildScheduledEventEntityType } from "discord.js";
import { logError, logWarn } from "../../logger";

type UpdateDiscordEventPayload = {
  guildId: string;
  stageChannelId: string;
  previousScheduledStart: string; // ISO
  newScheduledStart: string; // ISO
  scheduledMinutes: number;
};

function parseIsoOrNull(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pickEventByOldStart(
  events: GuildScheduledEvent[],
  oldStartMs: number
): GuildScheduledEvent | null {
  const exact = events.find((ev) => ev.scheduledStartTimestamp === oldStartMs);
  if (exact) return exact;

  // Fallback: nearest start within 10 minutes, to tolerate minor timestamp drift.
  let best: GuildScheduledEvent | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const ev of events) {
    const ts = ev.scheduledStartTimestamp;
    if (ts == null || !Number.isFinite(ts)) continue;
    const diff = Math.abs(ts - oldStartMs);
    if (diff <= 10 * 60_000 && diff < bestDiff) {
      best = ev;
      bestDiff = diff;
    }
  }
  return best;
}

export async function updateDiscordEventForReschedule(
  client: Client,
  p: UpdateDiscordEventPayload
): Promise<boolean> {
  const oldStart = parseIsoOrNull(p.previousScheduledStart);
  const newStart = parseIsoOrNull(p.newScheduledStart);
  if (!oldStart || !newStart) return false;

  const newEnd = new Date(newStart.getTime() + p.scheduledMinutes * 60_000);

  const guild = await client.guilds.fetch(p.guildId).catch(() => null);
  if (!guild) return false;

  try {
    const fetched = await guild.scheduledEvents.fetch();
    const candidatePool = [...fetched.values()].filter((ev) => {
      const sameChannel = ev.channelId === p.stageChannelId;
      const stageOrVoice =
        ev.channel?.type === ChannelType.GuildStageVoice ||
        ev.channel?.type === ChannelType.GuildVoice ||
        ev.entityType === GuildScheduledEventEntityType.StageInstance ||
        ev.entityType === GuildScheduledEventEntityType.Voice;
      return sameChannel && stageOrVoice;
    });

    const target = pickEventByOldStart(candidatePool, oldStart.getTime());
    if (!target) {
      logWarn(
        "updateDiscordEventForReschedule",
        `No scheduled event found near ${oldStart.toISOString()}`
      );
      return false;
    }

    await target.edit({
      scheduledStartTime: newStart,
      scheduledEndTime: newEnd,
    });
    return true;
  } catch (err) {
    logError("updateDiscordEventForReschedule", err);
    return false;
  }
}
