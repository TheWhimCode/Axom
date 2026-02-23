import type { Client } from "discord.js";
import { DateTime } from "luxon";
import {
  notifyOwnerWellbeing,
  type OwnerWellbeingKind,
} from "../services/selfcare/reminder";

// ---------------- Config ----------------
const TZ = process.env.OWNER_TZ ?? "Europe/Berlin";

// Daily “late” ping
const LATE_HOUR = Number(process.env.OWNER_LATE_HOUR ?? 20); // 20:00

// Reminder window (local TZ)
const START_HOUR = Number(process.env.OWNER_RANDOM_START_HOUR ?? 10); // 10:00
const END_HOUR = Number(process.env.OWNER_RANDOM_END_HOUR ?? 21); // 21:00 end-exclusive (last minute 20:59)

// Fixed daily counts
const WATER_PER_DAY = Number(process.env.OWNER_WATER_PER_DAY ?? 2);
const BREAK_PER_DAY = Number(process.env.OWNER_BREAK_PER_DAY ?? 1);

// Spacing between reminders (minutes)
const MIN_GAP_MINUTES = Number(process.env.OWNER_RANDOM_MIN_GAP_MINUTES ?? 75);

// How often we check whether a scheduled reminder is due
const TICK_SECONDS = Number(process.env.OWNER_WELLBEING_TICK_SECONDS ?? 30);

// ---------------- State ----------------
type Scheduled = { atISO: string; kind: Exclude<OwnerWellbeingKind, "late"> };

type State = {
  dayKey: string; // yyyy-LL-dd in TZ
  lateSentDayKey: string | null;

  schedule: Scheduled[];
  nextIndex: number;
};

const state: State = {
  dayKey: "",
  lateSentDayKey: null,
  schedule: [],
  nextIndex: 0,
};

function ensureDailyState(now: DateTime) {
  const dayKey = now.toFormat("yyyy-LL-dd");
  if (state.dayKey === dayKey) return;

  state.dayKey = dayKey;
  state.lateSentDayKey = null;

  state.schedule = buildDailySchedule(now);
  state.nextIndex = 0;

  console.log(
    `[OWNER_WELLBEING] new day=${dayKey} schedule=` +
      state.schedule
        .map(
          (s) =>
            `${s.kind}@${DateTime.fromISO(s.atISO, { zone: TZ }).toFormat(
              "HH:mm"
            )}`
        )
        .join(", ")
  );
}

function buildDailySchedule(now: DateTime): Scheduled[] {
  const dayStart = now.startOf("day");

  const windowStart = dayStart.set({
    hour: START_HOUR,
    minute: 0,
    second: 0,
    millisecond: 0,
  });

  const windowEnd = dayStart.set({
    hour: END_HOUR,
    minute: 0,
    second: 0,
    millisecond: 0,
  });

  const totalMinutes = Math.floor(
    windowEnd.diff(windowStart, "minutes").minutes
  );
  if (totalMinutes <= 0) return [];

  // IMPORTANT: avoid Array(n).fill("water") because it widens to string[]
  const kinds: Scheduled["kind"][] = [
    ...Array.from({ length: Math.max(0, WATER_PER_DAY) }, () => "water" as const),
    ...Array.from({ length: Math.max(0, BREAK_PER_DAY) }, () => "break" as const),
  ];

  if (kinds.length === 0) return [];

  // Pick random minute offsets with min-gap constraint
  const pickedOffsets: number[] = [];
  const maxAttempts = 5000;

  for (let i = 0; i < kinds.length; i++) {
    let ok = false;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const offset = Math.floor(Math.random() * totalMinutes); // 0..totalMinutes-1

      const tooClose = pickedOffsets.some(
        (o) => Math.abs(o - offset) < MIN_GAP_MINUTES
      );

      if (!tooClose) {
        pickedOffsets.push(offset);
        ok = true;
        break;
      }
    }

    if (!ok) {
      // Constraints too tight; pick any remaining time to avoid “no reminders today”
      pickedOffsets.push(Math.floor(Math.random() * totalMinutes));
    }
  }

for (let i = kinds.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  const tmp = kinds[i]!;     // safe: i in range
  kinds[i] = kinds[j]!;      // safe: j in range
  kinds[j] = tmp;
}

  const schedule: Scheduled[] = kinds.map((kind, idx) => {
    const at = windowStart.plus({ minutes: pickedOffsets[idx] });
    return { kind, atISO: at.toISO()! };
  });

  schedule.sort(
    (a, b) =>
      DateTime.fromISO(a.atISO, { zone: TZ }).toMillis() -
      DateTime.fromISO(b.atISO, { zone: TZ }).toMillis()
  );

  return schedule;
}

async function maybeSendLate(client: Client, now: DateTime) {
  const isLateTime = now.hour === LATE_HOUR && now.minute === 0;
  if (!isLateTime) return;
  if (state.lateSentDayKey === state.dayKey) return;

  const ok = await notifyOwnerWellbeing(client, "late");
  if (ok) state.lateSentDayKey = state.dayKey;
}

async function maybeSendDueRandoms(client: Client, now: DateTime) {
  // Send anything that is due (handles bot downtime gracefully)
  let sentThisTick = 0;
  const MAX_SEND_PER_TICK = 3;

  while (
    state.nextIndex < state.schedule.length &&
    sentThisTick < MAX_SEND_PER_TICK
  ) {
    const item = state.schedule[state.nextIndex]!;
    const dueAt = DateTime.fromISO(item.atISO, { zone: TZ });

    if (now < dueAt) break;

    const ok = await notifyOwnerWellbeing(client, item.kind);
    state.nextIndex += 1;

    if (ok) {
      sentThisTick += 1;
    } else {
      // If DM fails, don't spam-retry; move on.
      break;
    }
  }
}

async function tick(client: Client) {
  const now = DateTime.now().setZone(TZ);
  ensureDailyState(now);

  await maybeSendLate(client, now);
  await maybeSendDueRandoms(client, now);
}

export function startOwnerWellbeingCron(client: Client) {
  void tick(client);

  setInterval(() => {
    void tick(client);
  }, TICK_SECONDS * 1000);
}