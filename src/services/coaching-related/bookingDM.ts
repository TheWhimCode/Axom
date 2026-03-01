// src/services/coaching-related/bookingDM.ts
import { EmbedBuilder, type Client } from "discord.js";
import { DateTime } from "luxon";
import { logError } from "../../logger";
import { withRetry } from "../../utils/retry";

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

  // scheduledStart is ISO UTC (e.g. 2025-12-14T19:00:00.000Z)
  const dt = DateTime.fromISO(scheduledStart);
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
          ? `[${riotTag}](https://dpm.lol/${encodeURIComponent(
              riotTag.replace("#", "-")
            )})`
          : "—",
      },
      {
        name: "Notes",
        value: notes || "—",
      }
    );

  await withRetry(() => owner.send({ embeds: [embed] }), { attempts: 2, delayMs: 1500 }).catch(
    (err) => logError("bookingDM notifyOwner", err)
  );
}
