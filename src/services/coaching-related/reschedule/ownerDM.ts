// src/services/coaching-related/ownerRescheduledDM.ts

import { EmbedBuilder, type Client } from "discord.js";
import { DateTime } from "luxon";

const OWNER_ID = process.env.OWNER_ID!;

export interface OwnerRescheduledPayload {
  discordId: string | null;
  riotTag: string | null;
  sessionType: string;
  scheduledMinutes: number;
  notes: string | null;
  oldStartISO: string | null;
  newStartISO: string;
}

export async function notifyOwnerRescheduled(
  client: Client,
  p: OwnerRescheduledPayload
) {
  const owner = await client.users.fetch(OWNER_ID).catch(() => null);
  if (!owner) return false;

  const {
    discordId,
    riotTag,
    sessionType,
    scheduledMinutes,
    notes,
    oldStartISO,
    newStartISO,
  } = p;

  const newDt = DateTime.fromISO(newStartISO);
  const newUnix = Math.floor(newDt.toSeconds());

  const embed = new EmbedBuilder()
    .setColor(0xfee75c) // yellow-ish: “changed”
    .setTitle("Session rescheduled")
    .addFields(
      {
        name: "Student",
        value: discordId ? `<@${discordId}>` : "—",
      },
      {
        name: "New time",
        value: `<t:${newUnix}:F>`,
      },
      {
        name: "Duration",
        value: `${scheduledMinutes} min`,
        inline: true,
      },
      {
        name: "Type",
        value: sessionType,
        inline: true,
      }
    );

  if (oldStartISO) {
    const oldUnix = Math.floor(DateTime.fromISO(oldStartISO).toSeconds());
    embed.addFields({
      name: "Previous time",
      value: `<t:${oldUnix}:F>`,
    });
  }

  if (riotTag) {
    embed.addFields({
      name: "Riot",
      value: `[${riotTag}](https://dpm.lol/${encodeURIComponent(
        riotTag.replace("#", "-")
      )})`,
    });
  }

  if (notes) {
    embed.addFields({
      name: "Notes",
      value: notes,
    });
  }

  await owner.send({ embeds: [embed] }).catch(() => {});
  return true;
}
