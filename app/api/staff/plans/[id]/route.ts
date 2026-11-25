import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { ApiError, body, json, route } from "@/lib/server/http";
import { runPlan } from "@/lib/server/plans";
import { recurringPlans } from "@/lib/server/schema";
import { toPlan } from "@/lib/server/serialize";
import { logActivity } from "@/lib/server/settings";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const me = await requireUser("admin");
  const { id } = await params;
  const { action } = await body(req, z.object({ action: z.enum(["pause", "resume", "cancel", "issue-now"]) }));
  const db = await getDb();
  const [p] = await db.select().from(recurringPlans).where(eq(recurringPlans.id, id));
  if (!p) throw new ApiError(404, "Plan not found");
  let issued = 0;

  if (action === "issue-now") {
    if (p.status !== "active") throw new ApiError(409, "Only active plans can issue early");
    const r = await runPlan(db, id, { force: true });
    issued = r?.codes.length ?? 0;
    await logActivity(db, me.name, `Issued the next cycle early for ${p.recipientName}`, "plan", me.id);
  } else {
    const next = action === "pause" ? "paused" : action === "resume" ? "active" : "cancelled";
    const from = action === "resume" ? ["paused"] : action === "pause" ? ["active"] : ["active", "paused"];
    if (!from.includes(p.status)) throw new ApiError(409, `Can't ${action} a ${p.status} plan`);
    const patch: Partial<typeof recurringPlans.$inferInsert> = { status: next };
    if (action === "resume" && p.nextRunAt.getTime() < Date.now()) patch.nextRunAt = new Date(); // resume = next cycle issues now, no backlog
    await db.update(recurringPlans).set(patch).where(and(eq(recurringPlans.id, id)));
    await logActivity(db, me.name, `${action === "pause" ? "Paused" : action === "resume" ? "Resumed" : "Cancelled"} the recurring plan for ${p.recipientName}`, "plan", me.id);
  }
  const [fresh] = await db.select().from(recurringPlans).where(eq(recurringPlans.id, id));
  return json({ plan: toPlan(fresh), issued });
});
