// src/helper/utcFixer.ts
import { DateTime } from "luxon";

export function parseUTCString(ts: string) {
  // If it's already ISO (contains 'T'), parse as-is
  if (ts.includes("T")) {
    return DateTime.fromISO(ts);
  }

  // Otherwise convert "YYYY-MM-DD HH:mm:ss" → ISO
  const iso = ts.replace(" ", "T") + "Z";
  return DateTime.fromISO(iso);
}
