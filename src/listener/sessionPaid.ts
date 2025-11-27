// src/listener/sessionPaid.ts
import pg from "pg";
import EventEmitter from "events";

const DIRECT_DATABASE_URL = process.env.DIRECT_DATABASE_URL!;
const { Client: PgClient } = pg;

export const sessionEvents = new EventEmitter();

export function startSessionListener() {
  let client: pg.Client | null = null;

  async function connect() {
    try {
      if (client) {
        try { await client.end(); } catch {}
      }

      client = new PgClient({ connectionString: DIRECT_DATABASE_URL });
      await client.connect();
      await client.query("LISTEN sessions_paid");
      console.log("[PG] sessions_paid listener ready");

      client.on("notification", onNotification);
      client.on("error", onError);

    } catch {
      console.log("[PG] sessions_paid reconnecting…");
      retry();
    }
  }

  function retry() {
    setTimeout(connect, 5000);
  }

  function onNotification(msg: pg.Notification) {
    if (msg.channel !== "sessions_paid" || !msg.payload) return;

    try {
      const payload = JSON.parse(msg.payload);
      sessionEvents.emit("sessionPaid", payload);
    } catch {
      /* ignore bad json */
    }
  }

  function onError() {
    console.log("[PG] sessions_paid connection lost, reconnecting…");
    retry();
  }

  connect();
}
