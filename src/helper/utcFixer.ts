import { DateTime } from "luxon";

export function parseUTCString(ts: string) {
  const iso = ts.replace(" ", "T") + "Z";
  return DateTime.fromISO(iso);
}
