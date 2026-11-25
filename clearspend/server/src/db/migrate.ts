import { readFile } from "node:fs/promises";
import type pg from "pg";

/** Creates any missing tables. The SQL is idempotent so it is safe to run on every start-up. */
export async function runMigrations(pool: pg.Pool): Promise<void> {
    const schemaUrl = new URL("../../db/schema.sql", import.meta.url);
    const sql = await readFile(schemaUrl, "utf8");
    await pool.query(sql);
}
