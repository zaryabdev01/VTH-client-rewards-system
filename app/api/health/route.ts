import { sql } from "drizzle-orm";
import { getDb } from "@/lib/server/db";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export async function GET() {
  try { await (await getDb()).execute(sql`select 1`); return json({ ok: true, db: "up" }); }
  catch { return json({ ok: false, db: "down" }, { status: 503 }); }
}
