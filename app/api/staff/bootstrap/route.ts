import { desc, eq } from "drizzle-orm";
import { requireUser, toUserDto } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";
import { activity, codes, recurringPlans, rewards, users } from "@/lib/server/schema";
import { toActivity, toCode, toMember, toPlan, toReward } from "@/lib/server/serialize";
import { getSettings, getTemplates } from "@/lib/server/settings";

export const dynamic = "force-dynamic";

/** One call hydrates the whole portal. (Fine for the pilot volume; codes can be paginated server-side later.) */
export const GET = route(async () => {
  const me = await requireUser();
  const db = await getDb();
  await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, me.id));
  const [c, r, a, t, s, team, plans] = await Promise.all([
    db.select().from(codes).orderBy(desc(codes.createdAt)).limit(5000),
    db.select().from(rewards).orderBy(rewards.id),
    db.select().from(activity).orderBy(desc(activity.at)).limit(300),
    getTemplates(db), getSettings(db),
    db.select().from(users).orderBy(users.name),
    db.select().from(recurringPlans).orderBy(desc(recurringPlans.createdAt)),
  ]);
  return json({ user: toUserDto(me), codes: c.map(toCode), rewards: r.map(toReward), activity: a.map(toActivity), templates: t, settings: s, team: team.map(toMember), plans: plans.map(toPlan),
    // booleans only — never the secrets themselves
    system: { database: process.env.DATABASE_URL ? "postgres" : "embedded", turnstile: !!(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY), email: !!process.env.RESEND_API_KEY, cron: !!process.env.CRON_SECRET, appUrl: process.env.APP_URL ?? null } });
});
