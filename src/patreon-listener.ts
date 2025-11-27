// src/patreon-listener.ts
import pg from "pg";
import type { Client, TextChannel } from "discord.js";

const DIRECT_DATABASE_URL = process.env.DIRECT_DATABASE_URL!;
const PATREON_CHANNEL_ID = process.env.PATREON_CHANNEL_ID!;

export async function startPatreonPgListener(client: Client) {
  const { Client: PgClient } = pg;
  const pgc = new PgClient({ connectionString: DIRECT_DATABASE_URL });

  const connect = async () => {
    const u = new URL(DIRECT_DATABASE_URL);
    console.log("[PG] connecting to", u.host, u.pathname);
    await pgc.connect();
    await pgc.query("LISTEN patreon_posts");
    console.log("[PG] listening on patreon_posts");
  };

  pgc.on("error", (e) => {
    console.error("[PG][patreon_posts] error:", e);
    setTimeout(connect, 5000);
  });

  pgc.on("end", () => {
    console.warn("[PG] connection ended; reconnecting shortly…");
    setTimeout(connect, 5000);
  });

  // keep the connection alive (Neon can drop idle)
  setInterval(() => {
    pgc.query("SELECT 1").catch(() => {/* logged elsewhere */});
  }, 30_000);

  pgc.on("notification", async (msg) => {
    if (msg.channel !== "patreon_posts" || !msg.payload) return;
    console.log("[PG] notification:", msg.payload);
    try {
      const { url } = JSON.parse(msg.payload);
      if (!url) return;

      const fullUrl = url.startsWith("http") ? url : `https://www.patreon.com${url}`;
      const ch = await client.channels.fetch(PATREON_CHANNEL_ID).catch(() => null);
      if (ch && ch.isTextBased()) {
        await (ch as TextChannel).send({
          content: `${fullUrl}`, // raw link -> Discord auto preview
        });
      } else {
        console.error("[PG] channel fetch failed or not text-based");
      }
    } catch (err) {
      console.error("[PG][patreon_posts] bad payload:", err, msg.payload);
    }
  });

  await connect();
}
