// src/services/coaching-related/studentFollowupDM/ReturningDM.ts
import type { Client } from "discord.js";
import { logError } from "../../../logger";
import type { FollowupPayload } from "./index";

type ReturningFollowupOpts = {
  couponCode: string;
  couponValue: number;
};

export async function sendReturningFollowupDM(
  client: Client,
  p: FollowupPayload,
  opts: ReturningFollowupOpts
): Promise<boolean> {
  const { studentName, discordId } = p;

  if (!discordId) return false;

  const user = await client.users.fetch(discordId).catch(() => null);
  if (!user) return false;

  const msg = [
    `> **HEY ${studentName || "THERE"}!**`,
    `Another session done! 🎉`,
    ``,
    `Keep it simple: focus on the *1–2 key habits* — consistency makes it stick.`,
    `Here’s your **${opts.couponValue}€** code again: **\`${opts.couponCode}\`**`,
    ``,
    `Now it's time to crush these fools, go gain some LP!! 💥`,
  ].join("\n");

  try {
    await user.send(msg);
    return true;
  } catch (err) {
    logError("studentFollowupDM Returning", err);
    return false;
  }
}