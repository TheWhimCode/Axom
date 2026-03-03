// src/cron/ownerMorningSchedule.ts
import type { Client } from "discord.js";
import { DateTime } from "luxon";
import { pool } from "../db";
import { logError } from "../logger";
import type { SessionRow } from "../types/session";

const OWNER_ID = process.env.OWNER_ID!;
const TZ = process.env.OWNER_TZ ?? "Europe/Berlin";

type EventRow = {
  id: string;
  createdAt: Date;
  type: string;
  forField: string;
};

// Send at 08:00 local time.
// If the bot was offline at exactly 08:00, it will still send once as long as it's
// between 08:00 and 12:00 local time and hasn't sent yet today.
const MORNING_HOUR = Number(process.env.OWNER_MORNING_HOUR ?? 8);
const CUTOFF_HOUR = Number(process.env.OWNER_MORNING_CUTOFF_HOUR ?? 12);

let lastSentDayKey: string | null = null;

function formatEventLine(now: DateTime, ev: EventRow): string {
  const created = DateTime.fromJSDate(ev.createdAt).setZone(TZ);
  const diff = now.diff(created, "days").days;
  const days = Math.max(0, Math.floor(diff));

  const whenStr =
    days === 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;

  const colorPrefix = days < 3 ? "🔵" : days === 3 ? "🟠" : "🔴";

  return `${colorPrefix} ${ev.type} - ${ev.forField} - ${whenStr}`;
}

function makeMsgForDay(now: DateTime, rows: SessionRow[], events: EventRow[]) {
  const header = [
    `good morning ☀️`,
    `here’s today (${now.toFormat("ccc, LLL dd")})`,
    ``,
  ].join("\n");

  const lines = rows.map((s, idx) => {
    const unix = Math.floor(DateTime.fromJSDate(s.scheduledStart).toSeconds());
    const who = s.discordId ? `<@${s.discordId}>` : s.riotTag ? s.riotTag : "student";
    const dur = `${s.scheduledMinutes}m`;
    const type = s.sessionType;

    // Example line:
    // 1) 14:00 — <@id> — VOD Review (60m)
    return `${idx + 1}) <t:${unix}:t> — ${who} — ${type} (${dur})`;
  });

  const sessionSection =
    rows.length === 0
      ? [
          `no sessions today 😌`,
          ``,
          `free day unlocked 🫶`,
        ].join("\n")
      : [
          `sessions:`,
          ...lines,
          ``,
          `go be scary productive 🤍`,
        ].join("\n");

  const taskLines = events.map((ev) => formatEventLine(now, ev));

  const tasksSection = [
    `tasks:`,
    `Here's what needs to be done`,
    ...(taskLines.length > 0 ? taskLines : [`(no open requests)`]),
  ].join("\n");

  return header + [sessionSection, ``, tasksSection].join("\n");
}

async function sendOwnerMorningSchedule(client: Client) {
  const owner = await client.users.fetch(OWNER_ID).catch(() => null);
  if (!owner) return false;

  const now = DateTime.now().setZone(TZ);
  const dayKey = now.toFormat("yyyy-LL-dd");

  // already sent today
  if (lastSentDayKey === dayKey) return false;

  // only send once between MORNING_HOUR and CUTOFF_HOUR
  const hour = now.hour;
  if (hour < MORNING_HOUR || hour >= CUTOFF_HOUR) return false;

  const startLocal = now.startOf("day");
  const endLocal = startLocal.plus({ days: 1 });

  // Convert local day boundaries to UTC instants for DB query
  const startUtc = startLocal.toUTC().toJSDate();
  const endUtc = endLocal.toUTC().toJSDate();

  const res = await pool.query<SessionRow>(
    `
    SELECT
      id,
      "scheduledStart",
      "scheduledMinutes",
      "sessionType",
      "discordId",
      "riotTag",
      "notes",
      status
    FROM "Session"
    WHERE status IN ('paid')  -- adjust if you want to include other statuses
      AND "scheduledStart" >= $1
      AND "scheduledStart" < $2
    ORDER BY "scheduledStart" ASC
    `,
    [startUtc, endUtc]
  );

  const eventsRes = await pool.query<EventRow>(
    `
    SELECT
      id,
      "createdAt",
      type,
      "for" AS "forField"
    FROM "axom"."events"
    ORDER BY "createdAt" ASC
    `
  );

  const msg = makeMsgForDay(now, res.rows, eventsRes.rows);

  try {
    await owner.send(msg);
    lastSentDayKey = dayKey;
    return true;
  } catch (err) {
    logError("sessionsToday sendOwnerMorningSchedule", err);
    return false;
  }
}

export function startOwnerMorningScheduleCron(client: Client) {
  // run once immediately
  void sendOwnerMorningSchedule(client);

  // check every minute (cheap) so it can recover if the bot was offline at exactly 08:00
  setInterval(() => {
    void sendOwnerMorningSchedule(client);
  }, 60 * 1000);
}