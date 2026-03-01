/**
 * Run an async function with retries. Use for transient failures (e.g. Discord API, network).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; delayMs?: number } = {}
): Promise<T> {
  const { attempts = 3, delayMs = 1000 } = opts;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
}
