import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { body, json, route } from "@/lib/server/http";
import { recurringPlans } from "@/lib/server/schema";
import { logActivity } from "@/lib/server/settings";

const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500), action: z.enum(["pause", "resume", "cancel"]) });

/** Admin: pause / resume / cancel many recurring plans at once. Plans in the wrong state are skipped and counted. */
export const POST = route(async (req) => {
  const me = await requireUser("admin");
  const { ids, action } = await body(req, schema);
  const db = await getDb();
  const from = action === "resume" ? ["paused"] : action === "pause" ? ["active"] : ["active", "paused"];
  const to = action === "pause" ? "paused" : action === "resume" ? "active" : "cancelled";
  const rows = await db.update(recurringPlans).set({ status: to }).where(and(inArray(recurringPlans.id, ids), inArray(recurringPlans.status, from as ("active" | "paused")[]))).returning({ id: recurringPlans.id, next: recurringPlans.nextRunAt });
  // resume = the next cycle is issued on the next run, with no backlog of missed cycles
  const stale = rows.filter((r) => action === "resume" && r.next.getTime() < Date.now()).map((r) => r.id);
  if (stale.length) await db.update(recurringPlans).set({ nextRunAt: new Date() }).where(inArray(recurringPlans.id, stale));
  if (rows.length) await logActivity(db, me.name, `${action === "pause" ? "Paused" : action === "resume" ? "Resumed" : "Cancelled"} ${rows.length} recurring plan${rows.length === 1 ? "" : "s"} in bulk`, "plan", me.id);
  return json({ done: rows.length, skipped: ids.length - rows.length });
});
