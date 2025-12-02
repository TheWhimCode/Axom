// src/services/coaching-related/storeConfirmation.ts

import { Pool } from "pg";
import type { GuildMember } from "discord.js";

const pool = new Pool({
  connectionString: process.env.DIRECT_DATABASE_URL!,
  ssl: true,
});

// --- STORE the DM when it fails ---
export async function storePendingDM(discordId: string, message: string) {
  await pool.query(
    `
      INSERT INTO "PendingConfirmationDM" ("discordId", "message")
      VALUES ($1, $2)
      ON CONFLICT ("discordId") DO UPDATE
      SET "message" = EXCLUDED."message",
          "createdAt" = now()
    `,
    [discordId, message]
  );
}

// --- READ helper ---
async function getPendingDM(discordId: string) {
  const res = await pool.query(
    `SELECT "message" FROM "PendingConfirmationDM" WHERE "discordId" = $1`,
    [discordId]
  );
  return res.rows[0]?.message ?? null;
}

// --- DELETE helper ---
async function removePendingDM(discordId: string) {
  await pool.query(
    `DELETE FROM "PendingConfirmationDM" WHERE "discordId" = $1`,
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
  } catch {}

  await removePendingDM(discordId);
}
