import "dotenv/config";
import Fastify from "fastify";
import { Client, GatewayIntentBits, Events } from "discord.js";
import { Client as PgClient } from "pg";
import type { Notification } from "pg";

const bot = new Client({ intents: [GatewayIntentBits.Guilds] });
const OWNER_ID = process.env.OWNER_ID!;
const TOKEN = process.env.DISCORD_TOKEN!;
const DB_URL = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL!;
const api = Fastify();

async function dmOwner(text: string) {
  console.log("[DM] -> owner");
  const u = await bot.users.fetch(OWNER_ID);
  await u.send(text);
}

bot.once(Events.ClientReady, async () => {
  bot.user?.setPresence({ activities: [{ name: "sho-bot" }] });
  console.log("[BOT] online as", bot.user?.tag);
});
bot.login(TOKEN);

// --- Postgres LISTEN/NOTIFY with logs ---
const pg = new PgClient({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

async function startPgListener() {
  await pg.connect();
  console.log("[PG] connected");
  await pg.query("LISTEN sessions_paid");
  console.log("[PG] LISTEN sessions_paid");

  pg.on("notification", async (msg: Notification) => {
    console.log("[PG] notify:", msg.channel, msg.payload);
    if (!msg.payload) return;
    try {
      const d = JSON.parse(msg.payload);
      await dmOwner(`✅ New PAID session
Student: ${d.studentName}
When (UTC): ${d.scheduledStart}
ID: ${d.sessionId}`);
    } catch (e) {
      console.error("[PG] payload parse error:", e);
    }
  });

  pg.on("end", () => console.log("[PG] connection ended"));
  pg.on("error", (e: Error) => console.error("[PG] error:", e));
}
startPgListener().catch(e => {
  console.error("[PG] startup error:", e);
  process.exit(1);
});

// optional HTTP route you already had
api.post("/bookings/paid", async (req, reply) => {
  const { booking_id, student_name, when_utc, join_url } = req.body as {
    booking_id: string; student_name: string; when_utc: string; join_url?: string;
  };
  await dmOwner(`✅ New PAID booking
Student: ${student_name}
When (UTC): ${when_utc}
Join: ${join_url ?? "—"}
ID: ${booking_id}`);
  return { ok: true };
});

api.listen({ port: 3000, host: "0.0.0.0" })
  .then(addr => console.log("[API] listening on", addr))
  .catch(e => { console.error("[API] error:", e); process.exit(1); });
