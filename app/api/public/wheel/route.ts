import { asc } from "drizzle-orm";
import { getDb } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";
import { rewards } from "@/lib/server/schema";
import { toReward } from "@/lib/server/serialize";
import { turnstileEnabled } from "@/lib/server/turnstile";

export const dynamic = "force-dynamic";

/** Public: the 12 wheel sections (labels only matter for drawing; descriptions are revealed at spin time). */
export const GET = route(async () => {
  const db = await getDb();
  const rows = await db.select().from(rewards).orderBy(asc(rewards.id));
  return json({ rewards: rows.map(toReward), turnstile: turnstileEnabled() ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null : null });
});
