/**
 * Fixed-window rate limiter: at most `max` events per `windowMs` per key.
 * Timestamps are pruned so Maps don't grow unbounded on long-running processes.
 */
export function createRateLimiter(options: { windowMs: number; max: number }) {
  const { windowMs, max } = options;
  const hits = new Map<string, number[]>();

  function prune(key: string, now: number): number[] {
    const arr = hits.get(key) ?? [];
    const recent = arr.filter((t) => now - t < windowMs);
    if (recent.length === 0) hits.delete(key);
    else hits.set(key, recent);
    return recent;
  }

  /** Returns true if under limit (consumes one slot). False if rate limited. */
  function tryTake(key: string): boolean {
    const now = Date.now();
    const recent = prune(key, now);
    if (recent.length >= max) return false;
    recent.push(now);
    hits.set(key, recent);
    return true;
  }

  return { tryTake };
}
