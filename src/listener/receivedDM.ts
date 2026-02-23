// src/listener/receivedDM.ts
import type { Client, Message } from "discord.js";

const INBOX_CHANNEL_ID = process.env.INBOX_CHANNEL_ID!;

// 10 second cooldown per user
const CONFIRM_COOLDOWN_MS = 10_000;
const lastConfirmSent = new Map<string, number>();

const CONFIRM_MESSAGES = [
  "Noted!! Will let Sho know :cowboy:",
  "Got it — passing this to Sho 🔥",
  "Received! Sho will see this soon 📬",
  "Perfect — I’ll make sure Sho checks this :innocent:",
  "Message received! 👌",
];

function pickRandomConfirmation(): string {
  const i = Math.floor(Math.random() * CONFIRM_MESSAGES.length);
  return CONFIRM_MESSAGES[i] ?? "Noted!! Will let Sho know :cowboy:";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function registerDMListener(client: Client) {
  client.on("messageCreate", async (msg: Message) => {
    // Only DM from real users (not bot, not server messages)
    if (msg.guild || msg.author.bot) return;

    const inboxChannel = await client.channels
      .fetch(INBOX_CHANNEL_ID)
      .catch(() => null);

    if (!inboxChannel || !inboxChannel.isTextBased()) return;
    if (!("send" in inboxChannel)) return;

    // Forward DM to your private inbox channel
    await inboxChannel.send({
      content: `**DM from <@${msg.author.id}>**:\n${msg.content || "(no text)"}`,
    });

    // Minimum length requirement (8 characters, ignoring spaces)
    const content = (msg.content ?? "").trim();
    if (content.length < 8) return;

    // Cooldown check
    const now = Date.now();
    const lastSent = lastConfirmSent.get(msg.author.id) ?? 0;
    if (now - lastSent < CONFIRM_COOLDOWN_MS) return;

    lastConfirmSent.set(msg.author.id, now);

    try {
      const dmChannel = await msg.author.createDM();
      
      await dmChannel.sendTyping();   // start typing
      await sleep(2000);              // wait 2 seconds
      
      await dmChannel.send(pickRandomConfirmation());
    } catch {
      // ignore DM failures
    }
  });
}