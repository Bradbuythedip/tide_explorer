/**
 * Thin migration runner. Reads every .sql file in ../../sql/migrations
 * and runs it inside a single transaction against DATABASE_URL. Tracks
 * applied filenames in prevblock.schema_migrations.
 *
 * This is intentionally 30 lines and dependency-free. We're not going
 * to pull in knex/node-pg-migrate for a dozen DDL files. If the
 * migration set ever gets hairy enough to need branching, revisit.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { loadConfig } from "./config.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const migrationsDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    "sql",
    "migrations",
  );
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const pool = new Pool({ connectionString: config.DATABASE_URL });
  try {
    await pool.query(`
      CREATE SCHEMA IF NOT EXISTS prevblock;
      CREATE TABLE IF NOT EXISTS prevblock.schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    for (const file of files) {
      const already = await pool.query<{ filename: string }>(
        "SELECT filename FROM prevblock.schema_migrations WHERE filename = $1",
        [file],
      );
      if ((already.rowCount ?? 0) > 0) {
        console.log(`[skip] ${file}`);
        continue;
      }
      console.log(`[apply] ${file}`);
      const sql = readFileSync(join(migrationsDir, file), "utf8");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO prevblock.schema_migrations (filename) VALUES ($1)",
          [file],
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }
    console.log("migrations done");
  } finally {
    await pool.end();
  }
}

void main().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});
