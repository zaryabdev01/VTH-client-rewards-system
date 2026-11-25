import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { body, json, route } from "@/lib/server/http";
import { runPlan } from "@/lib/server/plans";
import { recurringPlans } from "@/lib/server/schema";
import { toPlan } from "@/lib/server/serialize";
import { logActivity } from "@/lib/server/settings";

const schema = z.object({
  name: z.string().trim().min(1, "Recipient name is required").max(120),
  org: z.string().trim().max(160).default(""),
  email: z.string().trim().email("A valid email is required — renewals are emailed automatically").max(200),
  frequency: z.enum(["weekly", "fortnightly", "monthly"]),
  spinsPerCycle: z.number().int().min(1).max(2),
  codeValidityDays: z.number().int().min(1).max(90),
  startsAt: z.string().datetime().optional(),
  maxCycles: z.number().int().min(1).max(60).nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

/** Admin: create a recurring plan. If it starts now, the first cycle's code(s) are issued and emailed immediately. */
export const POST = route(async (req) => {
  const me = await requireUser("admin");
  const d = await body(req, schema);
  const db = await getDb();
  const start = d.startsAt ? new Date(d.startsAt) : new Date();
  const [p] = await db.insert(recurringPlans).values({
    recipientName: d.name, organisation: d.org, email: d.email.toLowerCase(), frequency: d.frequency, spinsPerCycle: d.spinsPerCycle,
    codeValidityDays: d.codeValidityDays, startsAt: start, nextRunAt: start, maxCycles: d.maxCycles ?? null, endsAt: d.endsAt ? new Date(d.endsAt) : null,
    createdBy: me.id, createdByName: me.name,
  }).returning();
  await logActivity(db, me.name, `Created a ${d.frequency} recurring plan (${d.spinsPerCycle} spin${d.spinsPerCycle > 1 ? "s" : ""}) for ${d.name}`, "plan", me.id);
  const first = start.getTime() <= Date.now() ? await runPlan(db, p.id) : null;
  const [fresh] = await db.select().from(recurringPlans).where(eq(recurringPlans.id, p.id));
  return json({ plan: toPlan(fresh), issued: first?.codes.length ?? 0 });
});
