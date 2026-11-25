/** Apply SQL migrations to DATABASE_URL (production / CI). Usage: DATABASE_URL=... npm run db:migrate */
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await migrate(drizzle(pool), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await pool.end();
  console.log("migrations applied");
}
main().catch((e) => { console.error(e); process.exit(1); });
