// src/listener/receivedDM.ts
import type { ButtonInteraction, Client, Message } from "discord.js";
import { randomUUID } from "crypto";
import { logError } from "../logger";
import { pool } from "../db";
import { createRateLimiter } from "../rateLimit";

const INBOX_CHANNEL_ID = process.env.INBOX_CHANNEL_ID!;
const OWNER_ID = process.env.OWNER_ID!;

/** Soft cap on DM handling per user (avoids channel/DB/API churn if abused). */
const nonOwnerDmPerMin = createRateLimiter({ windowMs: 60_000, max: 35 });
const ownerDmPerMin = createRateLimiter({ windowMs: 60_000, max: 90 });
/** Inbox mirror forwards only (non-owner). */
const inboxForwardPerMin = createRateLimiter({ windowMs: 60_000, max: 30 });
/** Owner !followup / !analysis DB ops. */
const ownerCommandPerMin = createRateLimiter({ windowMs: 60_000, max: 45 });
/** Auto-confirm replies: short cooldown + hourly ceiling. */
const confirmHourly = createRateLimiter({ windowMs: 60 * 60_000, max: 72 });

// 10 second cooldown per user
const CONFIRM_COOLDOWN_MS = 10_000;
const lastConfirmSent = new Map<string, number>();

const MAX_FORWARD_CHARS = 3500;

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

type SendableChannel = { send: (opts: { content: string }) => Promise<unknown> };

export function registerDMListener(client: Client) {
  let inboxChannelCache: SendableChannel | null = null;

  async function getInboxChannel(): Promise<SendableChannel | null> {
    if (inboxChannelCache) return inboxChannelCache;
    const ch = await client.channels.fetch(INBOX_CHANNEL_ID).catch(() => null);
    if (ch?.isTextBased() && "send" in ch) inboxChannelCache = ch as SendableChannel;
    return inboxChannelCache;
  }

  client.on("messageCreate", async (msg: Message) => {
    // Only DM from real users (not bot, not server messages)
    if (msg.guild || msg.author.bot) return;

    const isOwner = msg.author.id === OWNER_ID;
    const dmOk = isOwner
      ? ownerDmPerMin.tryTake(msg.author.id)
      : nonOwnerDmPerMin.tryTake(msg.author.id);
    if (!dmOk) return;

    const inboxChannel = await getInboxChannel();
    if (!inboxChannel) return;

    // Forward DM to your private inbox channel (but not your own DMs)
    if (!isOwner && inboxForwardPerMin.tryTake(msg.author.id)) {
      const text = msg.content ?? "";
      const forwardBody =
        text.length > MAX_FORWARD_CHARS
          ? `${text.slice(0, MAX_FORWARD_CHARS)}…`
          : text || "(no text)";
      await inboxChannel.send({
        content: `**DM from <@${msg.author.id}>**:\n${forwardBody}`,
      });
    }

    const rawContent = (msg.content ?? "").trim();

    // Owner-only commands to add followup / analysis events
    if (isOwner && rawContent.startsWith("!")) {
      const [cmdRaw, ...restParts] = rawContent.split(/\s+/);
      const cmd = cmdRaw ?? "";
      const type = cmd.slice(1).toLowerCase();

      if (type === "followup" || type === "analysis") {
        if (!ownerCommandPerMin.tryTake("owner-cmd")) return;

        const isDone = restParts[restParts.length - 1]?.toLowerCase() === "done";
        const target = (isDone ? restParts.slice(0, -1) : restParts).join(" ").trim();

        if (!target) {
          await msg.reply(
            "Usage:\n" +
              "• `!followup <for>` or `!analysis <for>` (e.g. `!followup Axom`)\n" +
              "• `!followup <for> done` or `!analysis <for> done` to mark as completed."
          );
          return;
        }

        try {
          if (isDone) {
            const res = await pool.query(
              `
              DELETE FROM "axom"."events"
              WHERE "type" = $1 AND "for" = $2
              RETURNING id
              `,
              [type, target]
            );

            if (res.rowCount === 0) {
              await msg.reply(
                `No open **${type}** tasks found for **${target}**.`
              );
            } else {
              await msg.reply(
                `Marked the ${type} as done.`
              );
            }
          } else {
            const id = randomUUID();

            await pool.query(
              `
              INSERT INTO "axom"."events" (id, "type", "for")
              VALUES ($1, $2, $3)
              `,
              [id, type, target]
            );

            await msg.reply(`Added **${target}** **${type}**.`);
          }
        } catch (err) {
          logError("receivedDM insert event", err);
          const errMsg =
            err && typeof err === "object" && "message" in err
              ? String((err as Error).message)
              : String(err);
          await msg.reply(
            `I couldn't save that follow-up in the database.\nError: ${errMsg}`
          );
        }

        return;
      }
    }

    // Minimum length requirement (8 characters, ignoring spaces)
    const content = rawContent;
    if (content.length < 8) return;

    // Cooldown check
    const now = Date.now();
    const lastSent = lastConfirmSent.get(msg.author.id) ?? 0;
    if (now - lastSent < CONFIRM_COOLDOWN_MS) return;
    if (!confirmHourly.tryTake(msg.author.id)) return;

    lastConfirmSent.set(msg.author.id, now);

    try {
      const dmChannel = await msg.author.createDM();
      await dmChannel.sendTyping();
      await sleep(2000);
      await dmChannel.send(pickRandomConfirmation());
    } catch (err) {
      logError("receivedDM confirm", err);
    }
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("speed_review_optout:")) return;

    await handleSpeedReviewOptOut(interaction).catch((err) =>
      logError("speedReview optout interaction", err)
    );
  });
}

async function handleSpeedReviewOptOut(
  interaction: ButtonInteraction
): Promise<void> {
  const queueEntryId = interaction.customId.slice("speed_review_optout:".length);
  if (!queueEntryId) {
    await interaction.reply({
      content: "I couldn't read that queue entry. Please try again.",
    });
    return;
  }

  const res = await pool.query(
    `
    UPDATE "SpeedReviewQueue"
    SET "optOut" = TRUE
    WHERE id = $1
      AND "discordId" = $2
    `,
    [queueEntryId, interaction.user.id]
  );

  if (res.rowCount === 0) {
    await interaction.reply({
      content: "I couldn't opt you out for this queue entry.",
    });
    return;
  }

  await interaction.update({
    content:
      "✅ I won't annoy you with reminders anymore! :innocent:",
    components: [],
  });
}