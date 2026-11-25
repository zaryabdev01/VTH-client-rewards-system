import { mkdirSync } from "node:fs";
import path from "node:path";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { DEFAULT_REWARDS, DEFAULT_SETTINGS, DEFAULT_TEMPLATES } from "../shared";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;
const g = globalThis as unknown as { __vthDb?: Promise<DB> };

/** Singleton. DATABASE_URL -> real PostgreSQL (production). Otherwise embedded Postgres (PGlite) for local dev. */
export function getDb(): Promise<DB> {
  return (g.__vthDb ??= init().catch((e) => { g.__vthDb = undefined; throw e; }));
}

async function init(): Promise<DB> {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  let db: DB;
  let embedded = false;
  if (process.env.DATABASE_URL) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DATABASE_POOL ?? 5) });
    db = drizzle(pool, { schema });
    if (process.env.AUTO_MIGRATE === "true") {
      const { migrate } = await import("drizzle-orm/node-postgres/migrator");
      await migrate(db, { migrationsFolder });
    }
  } else {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_EMBEDDED_DB !== "true") {
      throw new Error("DATABASE_URL is not set. Refusing to start production with the embedded dev database.");
    }
    embedded = true;
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
    mkdirSync(path.dirname(dir), { recursive: true });
    const client = new PGlite(dir);
    const p = drizzle(client, { schema });
    await migrate(p, { migrationsFolder });
    db = p as unknown as DB;
  }
  await ensureBaseData(db, embedded);
  return db;
}

/** Idempotent: wheel sections, default settings, first admin. */
export async function ensureBaseData(db: DB, embedded: boolean) {
  const have = await db.select({ id: schema.rewards.id }).from(schema.rewards);
  if (have.length === 0) {
    await db.insert(schema.rewards).values(DEFAULT_REWARDS.map((r) => ({ id: r.id, label: r.label, name: r.name, description: r.desc, icon: r.icon })));
  }
  const s = await db.select().from(schema.settings).where(eq(schema.settings.key, "portal"));
  if (s.length === 0) {
    await db.insert(schema.settings).values([
      { key: "portal", value: DEFAULT_SETTINGS },
      { key: "templates", value: DEFAULT_TEMPLATES },
    ]).onConflictDoNothing();
  }
  const users = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  if (users.length === 0) {
    const { bootstrapAdmin, seedDemo } = await import("./seed");
    if (process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_PASSWORD) await bootstrapAdmin(db);
    else if (embedded && (process.env.NODE_ENV === "production" ? process.env.SEED_DEMO === "true" : process.env.SEED_DEMO !== "false")) await seedDemo(db);
  }
}
