import { DateTime } from "luxon";

export function parseUTCString(ts: string) {
  // Always parse as UTC, no matter the format
  return DateTime.fromISO(
    ts.includes("T") ? ts : ts.replace(" ", "T") + "Z",
    { zone: "utc" }
  );
}
