import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { body, json, route } from "@/lib/server/http";
import { createPlans } from "@/lib/server/plans";
import { toPlan } from "@/lib/server/serialize";

const settingsShape = {
  frequency: z.enum(["daily", "weekly", "fortnightly", "monthly", "yearly"]),
  spinsPerCycle: z.number().int().min(1).max(2),
  expireAtNext: z.boolean().default(true),
  codeValidityDays: z.number().int().min(1).max(400).default(30),
  startsAt: z.string().datetime().optional(),
  maxCycles: z.number().int().min(1).max(400).nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
};
const person = z.object({
  name: z.string().trim().min(1, "Recipient name is required").max(120),
  org: z.string().trim().max(160).default(""),
  email: z.string().trim().email("A valid email is required, renewals are emailed automatically").max(200),
});
const schema = z.object({ ...settingsShape, people: z.array(person).min(1).max(300) });

/** Admin: create recurring plans for one or many people. If a plan starts now, its first code is issued and emailed immediately. */
export const POST = route(async (req) => {
  const me = await requireUser("admin");
  const { people, ...d } = await body(req, schema);
  const db = await getDb();
  const { plans, issued } = await createPlans(db, me, people, d);
  return json({ plans: plans.map(toPlan), issued });
});
