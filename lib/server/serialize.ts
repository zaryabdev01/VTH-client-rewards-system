import type { Activity, Code, IconKey, Member, Plan, Reward } from "../shared";
import type { ActivityRow, CodeRow, PlanRow, RewardRow, User } from "./schema";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : undefined);

export const toCode = (r: CodeRow): Code => ({
  id: r.id, code: r.code, name: r.recipientName, org: r.organisation, email: r.email ?? "", createdBy: r.createdByName,
  createdAt: r.createdAt.toISOString(), expiresAt: r.expiresAt.toISOString(), status: r.status, emailedAt: iso(r.emailedAt),
  usedAt: iso(r.usedAt), rewardId: r.rewardId ?? undefined, ref: r.ref ?? undefined, fulfilment: r.fulfilment ?? undefined,
  planId: r.planId ?? undefined, cycleNo: r.cycleNo ?? undefined,
});

export const toReward = (r: RewardRow): Reward => ({ id: r.id, label: r.label, name: r.name, desc: r.description, icon: r.icon as IconKey });

export const toActivity = (r: ActivityRow): Activity => ({ id: r.id, at: r.at.toISOString(), who: r.actorName, text: r.text, kind: r.kind });

export const toMember = (u: User): Member => ({
  id: u.id, name: u.name, email: u.email, role: u.role, active: u.active,
  lastActive: iso(u.lastActiveAt) ?? null, invited: !u.passwordHash,
});

export const toPlan = (p: PlanRow): Plan => ({
  id: p.id, name: p.recipientName, org: p.organisation, email: p.email, frequency: p.frequency, spinsPerCycle: p.spinsPerCycle,
  codeValidityDays: p.codeValidityDays, startsAt: p.startsAt.toISOString(), nextRunAt: p.nextRunAt.toISOString(), endsAt: iso(p.endsAt),
  maxCycles: p.maxCycles ?? undefined, cyclesDone: p.cyclesDone, status: p.status, lastRunAt: iso(p.lastRunAt),
  createdBy: p.createdByName, createdAt: p.createdAt.toISOString(),
});
