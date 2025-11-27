// src/services/coaching-related/joinServerHold.ts

import { Pool } from "pg";
import type { GuildMember } from "discord.js";

const pool = new Pool({
  connectionString: process.env.DIRECT_DATABASE_URL!,
  ssl: true,
});

// --- DB helpers ---
async function getPendingDM(discordId: string) {
  const res = await pool.query(
    `SELECT message FROM pending_confirmation_DM WHERE discord_id = $1`,
    [discordId]
  );
  return res.rows[0]?.message ?? null;
}

async function removePendingDM(discordId: string) {
  await pool.query(
    `DELETE FROM pending_confirmation_DM WHERE discord_id = $1`,
    [discordId]
  );
}

// --- exported listener handler ---
export async function handlePendingDMOnJoin(member: GuildMember) {
  const discordId = member.id;

  const msg = await getPendingDM(discordId);
  if (!msg) return;

  try {
    await member.send(msg);
  } catch {
    // optional: silently fail or log
  }

  await removePendingDM(discordId);
}
