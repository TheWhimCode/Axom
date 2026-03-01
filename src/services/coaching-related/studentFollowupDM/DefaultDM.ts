import type { Client } from "discord.js";
import { logError } from "../../../logger";
import type { FollowupPayload } from "./index";

type DefaultFollowupOpts = {
  couponCode: string;
  couponValue: number;
};

export async function sendDefaultFollowupDM(
  client: Client,
  p: FollowupPayload,
  opts: DefaultFollowupOpts
): Promise<boolean> {
  const { studentName, discordId } = p;

  if (!discordId) return false;

  const user = await client.users.fetch(discordId).catch(() => null);
  if (!user) return false;

  const msg = [
    `> **HEY ${studentName || "THERE"}!**`,
    `> How are you feeling after the session? 😊`,
    `It’s totally normal to feel like your head is full of ideas :face_with_spiral_eyes: — just focus on *1–2 things at a time*. That’s how progress actually sticks ✨`,
    ``,
    `**> I can feel it. WinnersQ is up ahead! 📈**`,
    `Sho told me to give you this code — **\`${opts.couponCode}\`**!`,
    `It gives you **${opts.couponValue}€** off your next coaching session.`,
    `If a friend uses your code, they also get 5€ off — and your code gets a one-time 5€ upgrade 😱`,
    ``,
    `You can leave a review for Shos website or share some feedback if you want, just type it **right into this chat** — even a short message is perfect 💌`,
  ].join("\n");

  try {
    await user.send(msg);
    return true;
  } catch (err) {
    logError("studentFollowupDM Default", err);
    return false;
  }
}