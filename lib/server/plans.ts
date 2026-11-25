import { and, eq, lte } from "drizzle-orm";
import type { Frequency } from "../shared";
import { createCode } from "./codes";
import type { DB } from "./db";
import { recurringEmail, sendEmail } from "./email";
import { codes, recurringPlans, type CodeRow, type PlanRow } from "./schema";
import { getTemplates, logActivity } from "./settings";

/** Option 2: a recurring plan issues a FRESH one-time code (or two) each period and emails it automatically. */
export function addPeriod(from: Date, f: Frequency): Date {
  const d = new Date(from);
  if (f === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (f === "fortnightly") d.setUTCDate(d.getUTCDate() + 14);
  else {
    const day = d.getUTCDate();
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last)); // 31 Jan -> 28/29 Feb, not 3 Mar
  }
  return d;
}

export type RunSummary = { plansRun: number; codesIssued: number; completed: number; emailed: number; failedEmails: number };

/**
 * Issue the current cycle for one plan. Idempotent per cycle: the plan row is locked and `next_run_at` is advanced in the
 * same transaction that creates the codes, so overlapping cron runs or a double click can't issue twice.
 */
export async function runPlan(db: DB, planId: string, opts: { force?: boolean; now?: Date } = {}): Promise<{ codes: CodeRow[]; plan: PlanRow } | null> {
  const now = opts.now ?? new Date();
  const result = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(recurringPlans).where(eq(recurringPlans.id, planId)).for("update");
    if (!p || p.status !== "active") return null;
    if (!opts.force && p.nextRunAt.getTime() > now.getTime()) return null;

    const finished = (p.maxCycles != null && p.cyclesDone >= p.maxCycles) || (p.endsAt != null && p.nextRunAt.getTime() > p.endsAt.getTime());
    if (finished) {
      const [done] = await tx.update(recurringPlans).set({ status: "completed" }).where(eq(recurringPlans.id, p.id)).returning();
      await logActivity(tx, "System", `Recurring plan for ${p.recipientName} completed`, "plan");
      return { codes: [] as CodeRow[], plan: done };
    }

    const cycleNo = p.cyclesDone + 1;
    const issued: CodeRow[] = [];
    for (let i = 0; i < p.spinsPerCycle; i++) {
      issued.push(await createCode(tx, { name: p.recipientName, org: p.organisation, email: p.email, days: p.codeValidityDays, by: { id: null, name: "Auto-renewal" }, planId: p.id, cycleNo, now }));
    }
    let next = addPeriod(p.nextRunAt, p.frequency); // an early "issue now" counts as the next due cycle
    while (next.getTime() <= now.getTime()) next = addPeriod(next, p.frequency); // skip missed periods instead of flooding
    const cyclesDone = cycleNo;
    const ends = (p.maxCycles != null && cyclesDone >= p.maxCycles) || (p.endsAt != null && next.getTime() > p.endsAt.getTime());
    const [plan] = await tx.update(recurringPlans).set({ cyclesDone, lastRunAt: now, nextRunAt: next, status: ends ? "completed" : "active" }).where(eq(recurringPlans.id, p.id)).returning();
    await logActivity(tx, "System", `Auto-renewal #${cycleNo}: issued ${issued.length} fresh code${issued.length > 1 ? "s" : ""} for ${p.recipientName}`, "plan");
    return { codes: issued, plan };
  });

  // Email outside the transaction so a slow provider can't hold row locks. Unsent codes surface on the dashboard.
  if (result && result.codes.length) {
    const t = await getTemplates(db);
    const first = result.codes[0];
    const ok = await sendEmail(db, { to: result.plan.email, kind: "recurring", codeId: first.id, ...recurringEmail(t, { name: result.plan.recipientName, codes: result.codes.map((c) => c.code), expiresAt: first.expiresAt }) });
    if (ok) {
      await db.update(codes).set({ emailedAt: new Date() }).where(and(eq(codes.planId, result.plan.id), eq(codes.cycleNo, first.cycleNo ?? 0)));
      await logActivity(db, "System", `Emailed ${result.codes.length} new code${result.codes.length > 1 ? "s" : ""} to ${result.plan.email}`, "email");
    }
  }
  return result;
}

export async function runDuePlans(db: DB, now = new Date()): Promise<RunSummary> {
  const due = await db.select({ id: recurringPlans.id }).from(recurringPlans)
    .where(and(eq(recurringPlans.status, "active"), lte(recurringPlans.nextRunAt, now))).limit(200);
  const s: RunSummary = { plansRun: 0, codesIssued: 0, completed: 0, emailed: 0, failedEmails: 0 };
  for (const { id } of due) {
    try {
      const r = await runPlan(db, id, { now });
      if (!r) continue;
      s.plansRun++; s.codesIssued += r.codes.length; if (r.plan.status === "completed") s.completed++;
      const [c] = r.codes.length ? await db.select().from(codes).where(eq(codes.id, r.codes[0].id)) : [];
      if (c?.emailedAt) s.emailed++; else if (r.codes.length) s.failedEmails++;
    } catch (e) { console.error("[plans] run failed", id, e); }
  }
  return s;
}
