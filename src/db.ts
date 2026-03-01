// Shared PostgreSQL pool — use for one-off queries. LISTEN uses dedicated pg.Client in listeners.
import { Pool } from "pg";

const connectionString = process.env.DIRECT_DATABASE_URL!;

export const pool = new Pool({
  connectionString,
  ssl: true,
});

export function closePool(): Promise<void> {
  return pool.end();
}
