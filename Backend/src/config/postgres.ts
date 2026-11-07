import { Pool } from "pg";

let pool: Pool | null = null;

export async function connectPostgres(): Promise<void> {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query("SELECT 1"); // fail fast if the DB is unreachable
  console.log("PostgreSQL connected");
}

export function getPool(): Pool {
  if (!pool) throw new Error("PostgreSQL not connected");
  return pool;
}