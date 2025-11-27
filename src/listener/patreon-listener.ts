// src/patreon-listener.ts
import pg from "pg";
import type { Client, TextChannel } from "discord.js";

const DIRECT_DATABASE_URL = process.env.DIRECT_DATABASE_URL!;
const PATREON_CHANNEL_ID = process.env.PATREON_CHANNEL_ID!;

export async function startPatreonPgListener(client: Client) {
  const { Client: PgClient } = pg;
  const pgc = new PgClient({ connectionString: DIRECT_DATABASE_URL });

  const connect = async () => {
    await pgc.connect();
    await pgc.query("LISTEN patreon_posts");
    console.log("[PG] listening on patreon_posts");
  };

  pgc.on("error", (e) => {
    console.error("[PG][patreon_posts] error:", e);
    setTimeout(connect, 5000);
  });

  pgc.on("notification", async (msg) => {
    if (msg.channel !== "patreon_posts" || !msg.payload) return;
    try {
      const { url, title } = JSON.parse(msg.payload);
      const ch = await client.channels.fetch(PATREON_CHANNEL_ID).catch(() => null);
      if (ch && ch.isTextBased()) {
        await (ch as TextChannel).send({
          content: url
            ? `✨ New Patreon post: **${title ?? "New Patreon Post"}**\n${url}`
            : `✨ New Patreon post: **${title ?? "New Patreon Post"}**`,
        });
      }
    } catch (err) {
      console.error("[PG][patreon_posts] bad payload:", err, msg.payload);
    }
  });

  await connect();
}
