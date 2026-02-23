import type { Client } from "discord.js";
import { sendDefaultDM } from "./DefaultDM";
import { sendHasFollowupDM } from "./hasFollowup";

export type StudentConfirmPayload = {
  discordId: string | null;
  studentName: string | null;
  riotTag: string | null;
  scheduledStart: string; // ISO
  scheduledMinutes: number;
  sessionType: string;
  notes: string | null;

  // routing indicators
  paidCount: number;
  followups: number;
};

export async function notifyStudent(
  client: Client,
  payload: StudentConfirmPayload
): Promise<boolean> {
  if (!payload.discordId) return false;

  // For now: only one exception
  if ((payload.followups ?? 0) > 0) {
    return sendHasFollowupDM(client, payload);
  }

  return sendDefaultDM(client, payload);
}