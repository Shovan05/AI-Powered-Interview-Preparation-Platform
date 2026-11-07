import "dotenv/config";
import { Pool } from "pg";
import { runMigrations } from "../db/runMigrations";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await runMigrations(pool);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});