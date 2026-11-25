import { requireUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";
import { runDuePlans } from "@/lib/server/plans";

/** Admin: run the renewal job now (same function the daily cron calls). */
export const POST = route(async () => {
  await requireUser("admin");
  return json({ summary: await runDuePlans(await getDb()) });
});
