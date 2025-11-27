import pg from "pg";
import type { Client, TextChannel } from "discord.js";

const DIRECT_DATABASE_URL = process.env.DIRECT_DATABASE_URL!;
const PATREON_CHANNEL_ID = process.env.PATREON_CHANNEL_ID!;

export function startPatreonPgListener(client: Client) {
  const { Client: PgClient } = pg;

  let pgc: pg.Client | null = null;

  async function connect() {
    try {
      if (pgc) {
        try { await pgc.end(); } catch {}
      }

      pgc = new PgClient({ connectionString: DIRECT_DATABASE_URL });

      await pgc.connect();
      await pgc.query("LISTEN patreon_posts");
      console.log("[PG] listening on patreon_posts");

      pgc.on("notification", onNotification);
      pgc.on("error", onError);
    } catch (err) {
      console.error("[PG][patreon_posts] connect error:", err);
      retry();
    }
  }

  function retry() {
    setTimeout(connect, 5000);
  }

  async function onNotification(msg: pg.Notification) {
    if (!msg.payload) return;
    if (msg.channel !== "patreon_posts") return;

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
  }

  function onError(err: any) {
    console.error("[PG][patreon_posts] error:", err);
    retry();
  }

  connect();
}
