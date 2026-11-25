/** Load demo data into DATABASE_URL (STAGING ONLY). Refuses to run when NODE_ENV=production. */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../lib/server/schema";
import { ensureBaseData } from "../lib/server/db";
import { seedDemo } from "../lib/server/seed";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required (local dev seeds itself automatically)");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema }) as never;
  await ensureBaseData(db, false);
  await seedDemo(db);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
