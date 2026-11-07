import { Pool } from "pg";

let pool: Pool | null = null;

export async function connectPostgres(): Promise<void> {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Hosted databases (Render, Neon, Supabase) require SSL; local Docker does not.
    ssl: process.env.DATABASE_SSL === "true" ? true : undefined,
  });
  await pool.query("SELECT 1"); // fail fast if the DB is unreachable
  console.log("PostgreSQL connected");
}

export function getPool(): Pool {
  if (!pool) throw new Error("PostgreSQL not connected");
  return pool;
}

export async function closePostgres(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}