import { and, eq, lte } from "drizzle-orm";
import type { Frequency } from "../shared";
import { createCode } from "./codes";
import type { DB } from "./db";
import { recurringEmail, sendEmail } from "./email";
import { codes, recurringPlans, type CodeRow, type PlanRow } from "./schema";
import type { User } from "./schema";
import { getTemplates, logActivity } from "./settings";

/** A recurring plan issues ONE fresh code each period (with 1 or 2 spins) and emails it automatically. */
export function addPeriod(from: Date, f: Frequency): Date {
  const d = new Date(from);
  if (f === "daily") d.setUTCDate(d.getUTCDate() + 1);
  else if (f === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (f === "fortnightly") d.setUTCDate(d.getUTCDate() + 14);
  else if (f === "yearly") {
    const day = d.getUTCDate(), month = d.getUTCMonth();
    d.setUTCDate(1); d.setUTCFullYear(d.getUTCFullYear() + 1);
    const last = new Date(Date.UTC(d.getUTCFullYear(), month + 1, 0)).getUTCDate();
    d.setUTCMonth(month); d.setUTCDate(Math.min(day, last)); // 29 Feb -> 28 Feb
  } else {
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
    let next = addPeriod(p.nextRunAt, p.frequency); // an early "issue now" counts as the next due cycle
    while (next.getTime() <= now.getTime()) next = addPeriod(next, p.frequency); // skip missed periods instead of flooding
    // An unused code expires when the next allocation is due (or after a fixed number of days if the plan says so).
    const expiresAt = p.expireAtNext ? next : new Date(now.getTime() + p.codeValidityDays * 864e5);
    const issued: CodeRow[] = [await createCode(tx, { name: p.recipientName, org: p.organisation, email: p.email, expiresAt, spins: p.spinsPerCycle, by: { id: null, name: "Auto-renewal" }, planId: p.id, cycleNo, now })];
    const cyclesDone = cycleNo;
    const ends = (p.maxCycles != null && cyclesDone >= p.maxCycles) || (p.endsAt != null && next.getTime() > p.endsAt.getTime());
    const [plan] = await tx.update(recurringPlans).set({ cyclesDone, lastRunAt: now, nextRunAt: next, status: ends ? "completed" : "active" }).where(eq(recurringPlans.id, p.id)).returning();
    await logActivity(tx, "System", `Auto-renewal #${cycleNo}: issued a fresh ${p.spinsPerCycle}-spin code for ${p.recipientName}`, "plan");
    return { codes: issued, plan };
  });

  // Email outside the transaction so a slow provider can't hold row locks. Unsent codes surface on the dashboard.
  if (result && result.codes.length) {
    const t = await getTemplates(db);
    const first = result.codes[0];
    const ok = await sendEmail(db, { to: result.plan.email, kind: "recurring", codeId: first.id, ...recurringEmail(t, { name: result.plan.recipientName, code: first.code, expiresAt: first.expiresAt, spins: first.spinsAllowed }) });
    if (ok) {
      await db.update(codes).set({ emailedAt: new Date() }).where(and(eq(codes.planId, result.plan.id), eq(codes.cycleNo, first.cycleNo ?? 0)));
      await logActivity(db, "System", `Emailed the new code to ${result.plan.email}`, "email");
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

export type PlanSettings = {
  frequency: Frequency; spinsPerCycle: number; codeValidityDays: number; expireAtNext: boolean;
  startsAt?: string; maxCycles?: number | null; endsAt?: string | null;
};
export type Person = { name: string; org: string; email: string };

/** Create one plan per person; if it starts now, the first code is issued and emailed immediately. */
export async function createPlans(db: DB, me: Pick<User, "id" | "name">, people: Person[], d: PlanSettings): Promise<{ plans: PlanRow[]; issued: number }> {
  const start = d.startsAt ? new Date(d.startsAt) : new Date();
  const plans: PlanRow[] = []; let issued = 0;
  for (const person of people) {
    const [p] = await db.insert(recurringPlans).values({
      recipientName: person.name, organisation: person.org, email: person.email.toLowerCase(), frequency: d.frequency, spinsPerCycle: d.spinsPerCycle,
      codeValidityDays: d.codeValidityDays, expireAtNext: d.expireAtNext, startsAt: start, nextRunAt: start, maxCycles: d.maxCycles ?? null,
      endsAt: d.endsAt ? new Date(d.endsAt) : null, createdBy: me.id, createdByName: me.name,
    }).returning();
    await logActivity(db, me.name, `Created a ${d.frequency} recurring plan (${d.spinsPerCycle} spin${d.spinsPerCycle > 1 ? "s" : ""}) for ${person.name}`, "plan", me.id);
    const first = start.getTime() <= Date.now() ? await runPlan(db, p.id) : null;
    issued += first?.codes.length ?? 0;
    const [fresh] = await db.select().from(recurringPlans).where(eq(recurringPlans.id, p.id));
    plans.push(fresh);
  }
  return { plans, issued };
}
