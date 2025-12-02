// src/listener/receivedDM.ts
import type { Client, Message } from "discord.js";

const INBOX_CHANNEL_ID = process.env.INBOX_CHANNEL_ID!;

export function registerDMListener(client: Client) {
  client.on("messageCreate", async (msg: Message) => {
    // Only DM from real users (not the bot, not server messages)
    if (msg.guild || msg.author.bot) return;

    const channel = await client.channels
      .fetch(INBOX_CHANNEL_ID)
      .catch(() => null);

    if (!channel || !channel.isTextBased()) return;

    // Extra guard so TS knows `.send` exists
    if (!("send" in channel)) return;

    await channel.send({
      content: `**DM from <@${msg.author.id}>**:\n${msg.content || "(no text)"}`,
    });
  });
}
