// src/services/db/sessionListener.ts
import { Pool } from "pg";
import EventEmitter from "events";
import type { BookingPayload } from "../services/coaching-related/bookingDM";

const DIRECT_DATABASE_URL = process.env.DIRECT_DATABASE_URL!;

// exported event bus
export const sessionEvents = new EventEmitter();

// shared pool
const pool = new Pool({
  connectionString: DIRECT_DATABASE_URL,
  ssl: true,
});

export async function startSessionListener() {
  const pgClient = await pool.connect();

  pgClient.on("error", (err) => {
    console.error("[PG][sessions_paid] transient error", err);
  });

  await pgClient.query("LISTEN sessions_paid");
  console.log("[PG] listening on sessions_paid");

  pgClient.on("notification", (msg) => {
    if (msg.channel !== "sessions_paid" || !msg.payload) return;

    let payload: BookingPayload;
    try {
      payload = JSON.parse(msg.payload);
    } catch {
      return;
    }

    sessionEvents.emit("sessionPaid", payload);
  });
}
