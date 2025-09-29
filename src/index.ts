// src/index.ts
import { Client, GatewayIntentBits, EmbedBuilder, TextChannel } from "discord.js";
import pg from "pg";
import { DateTime } from "luxon";
import { startPatreonPgListener } from "./patreon-listener"; // <-- fixed

// --- ENV ---
const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;
const OWNER_ID = process.env.OWNER_ID!;
const DIRECT_DATABASE_URL = process.env.DIRECT_DATABASE_URL!;
const PATREON_CHANNEL_ID = process.env.PATREON_CHANNEL_ID!;

// --- Discord client ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
});

// --- PG LISTEN/NOTIFY for sessions_paid ---
const { Client: PgClient } = pg;
let pgClient: pg.Client | null = null;

async function connectPgSessions() {
  if (pgClient) try { await pgClient.end(); } catch {}
  pgClient = new PgClient({ connectionString: DIRECT_DATABASE_URL });

  pgClient.on("error", (err) => {
    console.error("[PG][sessions_paid] error", err);
    setTimeout(connectPgSessions, 5000);
  });

  await pgClient.connect();
  await pgClient.query("LISTEN sessions_paid");
  console.log("[PG] listening on sessions_paid");

  pgClient.on("notification", async (msg) => {
    if (msg.channel !== "sessions_paid" || !msg.payload) return;
    console.log("[PG] payload:", msg.payload);
    let payload: any;
    try { payload = JSON.parse(msg.payload); } catch { return; }
    await handleSessionPaid(payload);
  });
}

async function handleSessionPaid(p: any) {
  const owner = await client.users.fetch(OWNER_ID).catch(() => null);
  if (!owner) return;

  const { studentName, studentDiscord, riotTag, scheduledStart, scheduledMinutes, sessionType, notes } = p;

  const dt = DateTime.fromISO(scheduledStart, { zone: "Europe/Berlin" });
  const timeFormatted = `${dt.toFormat("dd LLL")}\n${dt.toFormat("HH:mm")}`;

  const embed = new EmbedBuilder()
    .setTitle(sessionType === "Custom Session" ? `New Custom Session [${scheduledMinutes} min]` : `New ${sessionType}`)
    .addFields(
      { name: "Student", value: studentDiscord ? `<@${studentDiscord}>` : (studentName || "—"), inline: false },
      { name: "Time", value: timeFormatted, inline: false },
      { name: "Riot", value: riotTag ? `[${riotTag}](https://dpm.lol/${riotTag.replace("#", "-")})` : "—", inline: false },
      { name: "Notes", value: notes || "—", inline: false },
    );

  await owner.send({ embeds: [embed] });
}

// --- Ready: start listeners ---
client.once("ready", () => {
  console.log(`Logged in as ${client.user?.tag}`);
  connectPgSessions().catch((e) => console.error("[PG] connect error", e));
  startPatreonPgListener(client); // uses PATREON_CHANNEL_ID + DIRECT_DATABASE_URL
});

// --- Login ---
client.login(DISCORD_TOKEN);

// (optional) helper
export async function postToPatreonChannel(content: string) {
  const ch = await client.channels.fetch(PATREON_CHANNEL_ID).catch(() => null);
  if (ch && ch.isTextBased()) await (ch as TextChannel).send({ content });
}
