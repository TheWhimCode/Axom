import type { Client } from "discord.js";
import { sendDefaultDM } from "./DefaultDM";
import { sendHasFollowupDM } from "./hasFollowup";
import { sendEloRushDM } from "./EloRushDM";

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

type MainDMKind = "default" | "eloRush";

function normalizeSessionType(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

async function pickMainDMKind(p: StudentConfirmPayload): Promise<MainDMKind> {
  if (normalizeSessionType(p.sessionType) === "elo rush") return "eloRush";
  return "default";
}

const CLOSING_FIRST = `**We're looking forward to working with you! 🥰**`;
const CLOSING_SECOND = `**Nice to see you again! — I see you're ready for the next steps! :fire:**`;
const CLOSING_THIRD_PLUS = `**Welcome back — let's build on last time! 🎯**`;

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

  console.log("[notifyStudent] followups =", payload.followups, "hasFollowup =", hasFollowup);

  const mainOk =
    kind === "eloRush"
      ? await sendEloRushDM(client, payload)
      : await sendDefaultDM(client, payload);

  if (!mainOk) return false;

  if (hasFollowup) {
    // Await instead of void — blocks until the full sequence (including closing line) completes.
    // This prevents a second notifyStudent call from racing through while the first is mid-sequence.
    await sendHasFollowupDM(client, payload, { closingLine });
    return true;
  }

  // No followup — send closing line directly
  void sendClosingLineWithTyping(client, payload.discordId, closingLine).catch(() => {});

  return true;
}