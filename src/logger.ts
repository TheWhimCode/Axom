/**
 * Centralized logging. Use logError for failures so we can later swap to a real logger.
 */
export function logError(scope: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[${scope}]`, message);
  if (stack && process.env.NODE_ENV !== "production") {
    console.error(stack);
  }
}

export function logWarn(scope: string, message: string): void {
  console.warn(`[${scope}]`, message);
}
