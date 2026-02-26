import type { Client } from "discord.js";
import {
  OWNER_WELLBEING_LINES,
  pickWeighted,
  type OwnerWellbeingKind,
} from "./ownerWellbeingLines";

const OWNER_ID = process.env.OWNER_ID!;

export { type OwnerWellbeingKind };

export async function notifyOwnerWellbeing(
  client: Client,
  kind: OwnerWellbeingKind
): Promise<boolean> {
  const owner = await client.users.fetch(OWNER_ID).catch(() => null);
  if (!owner) return false;

  const pool = OWNER_WELLBEING_LINES[kind];
  if (!pool || pool.length === 0) return false;

  const chosen = pickWeighted(pool);

  // Plain text message (no embed)
  const message = [
    `**${chosen.title}**`,
    "",
    chosen.description,
  ].join("\n");

  try {
    await owner.send(message);
    return true;
  } catch {
    return false;
  }
}