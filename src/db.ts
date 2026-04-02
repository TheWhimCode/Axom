// Shared PostgreSQL pool — use for one-off queries. LISTEN uses dedicated pg.Client in listeners.
import { Pool } from "pg";

const connectionString = process.env.DIRECT_DATABASE_URL!;

export const pool = new Pool({
  connectionString,
  ssl: true,
  // Cap concurrent queries so a burst can't exhaust DB connections on small hosts (e.g. Railway).
  max: Math.max(2, Math.min(25, Number(process.env.PG_POOL_MAX ?? 10))),
});

export function closePool(): Promise<void> {
  return pool.end();
}
