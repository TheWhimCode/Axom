import type { Client } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { DateTime } from "luxon";
import { logError } from "../logger";

const OWNER_ID = process.env.OWNER_ID!;
const TZ = process.env.OWNER_TZ ?? "Europe/Berlin";
const LATE_HOUR = Number(process.env.OWNER_LATE_HOUR ?? 20); // 20:00
const TICK_SECONDS = Number(process.env.OWNER_WELLBEING_TICK_SECONDS ?? 30);

let lateSentDayKey: string | null = null;

async function maybeSend8pm(client: Client) {
  const now = DateTime.now().setZone(TZ);
  const dayKey = now.toFormat("yyyy-LL-dd");

  if (now.hour !== LATE_HOUR || now.minute !== 0) return;
  if (lateSentDayKey === dayKey) return;

  const owner = await client.users.fetch(OWNER_ID).catch(() => null);
  if (!owner) return;

  try {
    const embed = new EmbedBuilder()
      .setDescription("it's 8 pm")
      .setColor(0x5865f2);

    await owner.send({ embeds: [embed] });
    lateSentDayKey = dayKey;
  } catch (err) {
    logError("selfcare 8pm", err);
  }
}

export function startOwnerWellbeingCron(client: Client) {
  void maybeSend8pm(client);

  setInterval(() => {
    void maybeSend8pm(client);
  }, TICK_SECONDS * 1000);
}
