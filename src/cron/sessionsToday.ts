// src/cron/ownerMorningSchedule.ts
import type { Client } from "discord.js";
import { EmbedBuilder } from "discord.js";
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

function buildMorningEmbeds(
  now: DateTime,
  rows: SessionRow[],
  events: EventRow[]
): EmbedBuilder[] {
  const embeds: EmbedBuilder[] = [];

  if (rows.length > 0) {
    const sessionLines = rows.map((s) => {
      const unix = Math.floor(DateTime.fromJSDate(s.scheduledStart).toSeconds());
      const who = s.discordId ? `<@${s.discordId}>` : s.riotTag ?? "student";
      const dur = `${s.scheduledMinutes}m`;
      return `• <t:${unix}:t> — ${who} — ${s.sessionType} (${dur})`;
    });
    embeds.push(
      new EmbedBuilder()
        .setTitle("Today's sessions")
        .setDescription(sessionLines.join("\n"))
        .setColor(0x5865f2)
    );
  }

  if (events.length > 0) {
    const taskLines = events.map((ev) => formatEventLine(now, ev));
    embeds.push(
      new EmbedBuilder()
        .setTitle("Tasks")
        .setDescription(taskLines.join("\n"))
        .setColor(0x5865f2)
    );
  }

  return embeds;
}

async function sendOwnerMorningSchedule(client: Client) {
  const owner = await client.users.fetch(OWNER_ID).catch(() => null);
  if (!owner) return false;

  const now = DateTime.now().setZone(TZ);
  const dayKey = now.toFormat("yyyy-LL-dd");

  if (lastSentDayKey === dayKey) return false;

  const hour = now.hour;
  if (hour < MORNING_HOUR || hour >= CUTOFF_HOUR) return false;

  const startLocal = now.startOf("day");
  const endLocal = startLocal.plus({ days: 1 });
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
    WHERE status IN ('paid')
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

  const embeds = buildMorningEmbeds(now, res.rows, eventsRes.rows);

  try {
    if (embeds.length === 0) {
      await owner.send("Nothing scheduled today.");
    } else {
      await owner.send({ embeds });
    }
    lastSentDayKey = dayKey;
    return true;
  } catch (err) {
    logError("sessionsToday sendOwnerMorningSchedule", err);
    return false;
  }
}

export function startOwnerMorningScheduleCron(client: Client) {
  void sendOwnerMorningSchedule(client);
  setInterval(() => {
    void sendOwnerMorningSchedule(client);
  }, 60 * 1000);
}
