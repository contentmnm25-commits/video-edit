import path from "node:path";
import fs from "node:fs";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import * as schema from "./schema";

// Both drivers expose the same query API; we type everything as node-postgres.
export type Db = NodePgDatabase<typeof schema>;

type Holder = { db?: Db; kind?: "pg" | "pglite"; migrated?: Promise<void> };
const g = globalThis as unknown as { __assetTrackerDb?: Holder };
const holder: Holder = (g.__assetTrackerDb ??= {});

export const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");
// PGLITE_DATA_DIR=memory:// gives a throwaway in-memory database (used by tests).
export const PGLITE_DIR = process.env.PGLITE_DATA_DIR || path.join(process.cwd(), ".data", "pglite");

export function getDb(): Db {
  if (holder.db) return holder.db;
  const url = process.env.DATABASE_URL;
  if (url) {
    const pool = new Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX ?? 5) });
    holder.db = drizzlePg(pool, { schema });
    holder.kind = "pg";
  } else {
    if (!PGLITE_DIR.startsWith("memory://")) fs.mkdirSync(PGLITE_DIR, { recursive: true });
    const client = new PGlite(PGLITE_DIR);
    holder.db = drizzlePglite(client, { schema }) as unknown as Db;
    holder.kind = "pglite";
  }
  return holder.db;
}

/** Applies pending SQL migrations from ./drizzle. Safe to call repeatedly. */
export function runMigrations(): Promise<void> {
  holder.migrated ??= (async () => {
    const db = getDb();
    if (holder.kind === "pg") {
      await migratePg(db, { migrationsFolder: MIGRATIONS_DIR });
    } else {
      await migratePglite(db as never, { migrationsFolder: MIGRATIONS_DIR });
    }
  })();
  return holder.migrated;
}
