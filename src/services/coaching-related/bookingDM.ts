// src/services/coaching-related/bookingDM.ts

import { EmbedBuilder, type Client } from "discord.js";
import { DateTime } from "luxon";
import { parseUTCString } from "../../helper/utcFixer";

const OWNER_ID = process.env.OWNER_ID!;

export interface BookingPayload {
  discordId: string | null;
  studentName: string | null;
  riotTag: string | null;
  scheduledStart: string;
  scheduledMinutes: number;
  sessionType: string;
  notes: string | null;
}

export async function notifyOwner(client: Client, p: BookingPayload) {
  const owner = await client.users.fetch(OWNER_ID).catch(() => null);
  if (!owner) return;

  const {
    studentName,
    discordId,
    riotTag,
    scheduledStart,
    scheduledMinutes,
    sessionType,
    notes,
  } = p;

  // Always normalize timestamps properly
  const dt = parseUTCString(scheduledStart);
  console.log("SCHEDULED START RECEIVED:", scheduledStart);

  const unix = Math.floor(dt.toSeconds());

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(
      sessionType === "Custom Session"
        ? `New Custom Session [${scheduledMinutes} min]`
        : `New ${sessionType}`
    )
    .addFields(
      {
        name: "Student",
        value: discordId ? `<@${discordId}>` : (studentName || "—"),
      },
      {
        name: "Time",
        value: `<t:${unix}:F>`, // Auto-localized for viewer
      },
      {
        name: "Riot",
value: riotTag
  ? `[${riotTag}](https://dpm.lol/${encodeURIComponent(riotTag.replace("#", "-"))})`
  : "—",

      },
      {
        name: "Notes",
        value: notes || "—",
      }
    );

  await owner.send({ embeds: [embed] }).catch(() => {});
}
