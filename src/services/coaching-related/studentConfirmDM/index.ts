import type { Client } from "discord.js";
import { sendDefaultDM } from "./DefaultDM";
import { sendHasFollowupDM } from "./hasFollowup";
import { sendEloRushDM } from "./EloRushDM";
import { sendReturningDM } from "./ReturningDM";
import { createDiscordEvent } from "../createDiscordEvent";

export type StudentConfirmPayload = {
  discordId: string | null;
  studentName: string | null;
  riotTag: string | null;
  scheduledStart: string;
  scheduledMinutes: number;
  sessionType: string;
  notes: string | null;

  paidCount: number;
  followups: number;
};

type MainDMKind = "default" | "eloRush" | "returning";

function normalizeSessionType(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

function isReturningStudent(p: StudentConfirmPayload): boolean {
  const n = Number(p.paidCount ?? 0);
  // If they've paid 2+ times, this booking is at least their 2nd session.
  return n >= 2;
}

async function pickMainDMKind(p: StudentConfirmPayload): Promise<MainDMKind> {
  // Returning DM overrides session type (per your request)
  if (isReturningStudent(p)) return "returning";

  // First session: choose based on session type
  if (normalizeSessionType(p.sessionType) === "elo rush") return "eloRush";
  return "default";
}

const CLOSING_FIRST = `**We're looking forward to working with you! 🥰**`;
const CLOSING_SECOND = `**Nice to see you again! —** I see you're ready for the next steps! :fire:`;
const CLOSING_THIRD_PLUS = `**Welcome back —** let's build on last time! 🎯`;

function pickClosingLine(p: StudentConfirmPayload): string {
  const n = Number(p.paidCount ?? 0);
  if (n <= 1) return CLOSING_FIRST;
  if (n === 2) return CLOSING_SECOND;
  return CLOSING_THIRD_PLUS;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendClosingLineWithTyping(
  client: Client,
  discordId: string,
  closingLine: string
) {
  const user = await client.users.fetch(discordId).catch(() => null);
  if (!user) return false;

  const channel = await user.createDM().catch(() => null);
  if (!channel) return false;

  await channel.sendTyping();
  await sleep(2000);
  await channel.send(closingLine);

  return true;
}

export async function notifyStudent(
  client: Client,
  payload: StudentConfirmPayload
): Promise<boolean> {
  if (!payload.discordId) return false;

  const hasFollowup = (payload.followups ?? 0) > 0;
  const kind = await pickMainDMKind(payload);
  const closingLine = pickClosingLine(payload);

  console.log(
    "[notifyStudent] paidCount =",
    payload.paidCount,
    "followups =",
    payload.followups,
    "hasFollowup =",
    hasFollowup,
    "kind =",
    kind
  );

  const mainOk =
    kind === "returning"
      ? await sendReturningDM(client, payload)
      : kind === "eloRush"
        ? await sendEloRushDM(client, payload)
        : await sendDefaultDM(client, payload);

  if (!mainOk) return false;

  // DM succeeded => create Discord event (best-effort).
  // You chose: no idempotency / no DB field; worst-case is event missing on outages.
  void createDiscordEvent(client, {
    guildId: process.env.DISCORD_SERVER_ID!,
    stageChannelId: process.env.STAGE_CHANNEL_ID!,
    scheduledStart: payload.scheduledStart,
    scheduledMinutes: payload.scheduledMinutes,
    sessionType: payload.sessionType,
    studentName: payload.studentName,
    riotTag: payload.riotTag,
  }).catch(() => {});

  if (hasFollowup) {
    // Await instead of void — blocks until the full sequence (including closing line) completes.
    // This prevents a second notifyStudent call from racing through while the first is mid-sequence.
    await sendHasFollowupDM(client, payload, { closingLine });
    return true;
  }

  // No followup — send closing line directly
  void sendClosingLineWithTyping(client, payload.discordId, closingLine).catch(
    () => {}
  );

  return true;
}