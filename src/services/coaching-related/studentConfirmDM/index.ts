import type { Client } from "discord.js";
import { logError } from "../../../logger";
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
  champions: string[] | null;
  league: string | null;
  division: string | null;
};

type MainDMKind = "default" | "eloRush" | "returning";

function normalizeSessionType(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

function isReturningStudent(p: StudentConfirmPayload): boolean {
  const n = Number(p.paidCount ?? 0);
  return n >= 2;
}

async function pickMainDMKind(p: StudentConfirmPayload): Promise<MainDMKind> {
  if (isReturningStudent(p)) return "returning";
  if (normalizeSessionType(p.sessionType) === "elo rush") return "eloRush";
  return "default";
}

// --------------------
// Closing Lines (1–8)
// --------------------

function pickClosingLine(p: StudentConfirmPayload): string {
  const n = Number(p.paidCount ?? 0);

  switch (n) {
    case 1:
      return `**We’re looking forward to working with you! 🥰**`;
    case 2:
      return `**Nice to see you again! —** I see you're ready for the next steps! 🔥`;
    case 3:
      return `**Welcome back —** let’s build on last time! 🎯`;
    case 4:
      return `**Look who’s here again 😌** Welcome back.`;
    case 5:
      return `**HEY AGAIN!! 😄** We’re really building something here.`;
    case 6:
      return `**You're back!! :innocent:** I was starting to miss you.`;
    case 7:
      return `**That's some dedication 😤📈** Let's make this one count.`;
    default:
      return `**Back at it!! 🔁✨** I love seeing this kind of consistency.`;
  }
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

  const mainOk =
    kind === "returning"
      ? await sendReturningDM(client, payload)
      : kind === "eloRush"
        ? await sendEloRushDM(client, payload)
        : await sendDefaultDM(client, payload);

  if (!mainOk) return false;

  void createDiscordEvent(client, {
    guildId: process.env.DISCORD_SERVER_ID!,
    stageChannelId: process.env.STAGE_CHANNEL_ID!,
    scheduledStart: payload.scheduledStart,
    scheduledMinutes: payload.scheduledMinutes,
    sessionType: payload.sessionType,
    studentName: payload.studentName,
    riotTag: payload.riotTag,
    champions: payload.champions,
    league: payload.league,
    division: payload.division,
  }).catch((err) => logError("studentConfirmDM createDiscordEvent", err));

  if (hasFollowup) {
    await sendHasFollowupDM(client, payload, { closingLine });
    return true;
  }

  void sendClosingLineWithTyping(client, payload.discordId, closingLine).catch((err) =>
    logError("studentConfirmDM closingLine", err)
  );

  return true;
}