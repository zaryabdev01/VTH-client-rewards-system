import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";
import { createCode } from "./codes";
import type { DB } from "./db";
import { activity, codes, recurringPlans, users } from "./schema";
import { addPeriod } from "./plans";

const DAY = 864e5;

/** Production: first admin from env. Password is hashed; the env var can be removed afterwards. */
export async function bootstrapAdmin(db: DB) {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL!.toLowerCase();
  await db.insert(users).values({ name: process.env.BOOTSTRAP_ADMIN_NAME ?? "VTH Admin", email, passwordHash: await hashPassword(process.env.BOOTSTRAP_ADMIN_PASSWORD!), role: "admin" }).onConflictDoNothing();
  console.log(`[seed] created first admin ${email}`);
}

/** Local/staging only: realistic demo data so every screen has something to show. Never runs in production. */
export async function seedDemo(db: DB) {
  const pw = process.env.DEMO_PASSWORD ?? "VthDemo2026!";
  const hash = await hashPassword(pw);
  const now = Date.now();
  const staff = await db.insert(users).values([
    { name: "Olivia Hart", email: "olivia.hart@vth.co.uk", passwordHash: hash, role: "admin", lastActiveAt: new Date(now - 6e5) },
    { name: "James Whitfield", email: "james.whitfield@vth.co.uk", passwordHash: hash, role: "standard", lastActiveAt: new Date(now - 3 * 36e5) },
    { name: "Priya Nair", email: "priya.nair@vth.co.uk", passwordHash: hash, role: "standard", lastActiveAt: new Date(now - 26 * 36e5) },
    { name: "Daniel Cole", email: "daniel.cole@vth.co.uk", passwordHash: hash, role: "standard", active: false, lastActiveAt: new Date(now - 9 * DAY) },
  ]).returning();

  const people: [string, string][] = [
    ["Sarah Mitchell", "Brightwave Ltd"], ["Tom Ashworth", "Northgate Logistics"], ["Amira Khan", "Halcyon Health"], ["Ben Fraser", "Fraser & Co"],
    ["Chloe Bennett", "Lumen Digital"], ["Mark Ellison", "Riverside Council"], ["Hannah Price", "Kestrel Energy"], ["Rahul Sharma", "Apex Dental Group"],
    ["Laura Jenkins", "Oakfield Academy"], ["Peter Nowak", "Sterling Builders"], ["Grace Okafor", "Meridian Care"], ["Callum Reid", "Highland Foods"],
    ["Zoe Turner", "Pixel & Pine"], ["Imran Ali", "Crescent Pharmacy"], ["Emily Walsh", "Walsh Architects"], ["Oscar Bell", "Tidewater Marine"],
    ["Nina Petrova", "Kinetic Fitness"], ["Harry Dixon", "Dixon Legal"], ["Aisha Rahman", "Bloom Nurseries"], ["George Palmer", "Palmer Motors"],
  ];
  for (let i = 0; i < people.length; i++) {
    const [name, org] = people[i];
    const by = staff[i % 3];
    const created = new Date(now - (i * 1.2 + 0.2) * DAY);
    const email = `${name.split(" ")[0].toLowerCase()}@${org.toLowerCase().replace(/[^a-z]/g, "")}.co.uk`;
    const used = i === 2 || (i % 3 === 1 && i !== 1);
    const cancelled = !used && i % 7 === 3 && i > 5;
    const expired = i === 1;
    const code = await createCode(db, { name, org, email, days: 14, by: { id: by.id, name: by.name }, now: created });
    const patch: Partial<typeof codes.$inferInsert> = { emailedAt: i % 6 === 5 ? null : new Date(created.getTime() + 6e5) };
    if (i === 0) patch.expiresAt = new Date(now + 3 * DAY);
    else if (expired) patch.expiresAt = new Date(now - 2 * DAY);
    else if (!used) patch.expiresAt = new Date(now + (((i * 3) % 12) + 3) * DAY);
    const fixed: Record<number, string> = { 0: "VTH-DEMO-VALD-2026", 1: "VTH-DEMO-EXPD-2026", 2: "VTH-DEMO-USED-2026" };
    if (fixed[i]) patch.code = fixed[i];
    if (i === 5) patch.expiresAt = new Date(now + 30 * 36e5);
    if (used) Object.assign(patch, { status: "used", usedAt: new Date(created.getTime() + 0.2 * DAY), rewardId: ((i * 5) % 12) + 1, ref: `REF-${randomBytes(4).toString("hex").toUpperCase()}`, fulfilment: i % 2 ? "fulfilled" : "pending" });
    if (cancelled) patch.status = "cancelled";
    await db.update(codes).set(patch).where(eq(codes.id, code.id));
    await db.insert(activity).values({ at: created, actorName: by.name, actorId: by.id, text: `Generated a code for ${name} (${org})`, kind: "code" });
    if (patch.emailedAt) await db.insert(activity).values({ at: patch.emailedAt as Date, actorName: by.name, actorId: by.id, text: `Emailed code to ${email}`, kind: "email" });
    if (used) await db.insert(activity).values({ at: patch.usedAt as Date, actorName: name, text: "Spun the wheel and won a reward", kind: "spin" });
  }

  // Two example recurring plans (option 2: fresh code each period)
  const start = new Date(now - 20 * DAY);
  const planRows = await db.insert(recurringPlans).values([
    { recipientName: "Sarah Mitchell", organisation: "Brightwave Ltd", email: "sarah@brightwaveltd.co.uk", frequency: "monthly", spinsPerCycle: 2, codeValidityDays: 30, startsAt: start, nextRunAt: addPeriod(start, "monthly"), maxCycles: 6, cyclesDone: 1, lastRunAt: start, createdBy: staff[0].id, createdByName: staff[0].name },
    { recipientName: "Amira Khan", organisation: "Halcyon Health", email: "amira@halcyonhealth.co.uk", frequency: "weekly", spinsPerCycle: 1, codeValidityDays: 7, startsAt: start, nextRunAt: new Date(now + 2 * DAY), cyclesDone: 3, lastRunAt: new Date(now - 5 * DAY), createdBy: staff[1].id, createdByName: staff[1].name },
  ]).returning();
  for (const p of planRows) {
    for (let c = 1; c <= p.cyclesDone; c++) {
      const when = new Date(p.startsAt.getTime() + (c - 1) * (p.frequency === "weekly" ? 7 : 30) * DAY);
      for (let k = 0; k < p.spinsPerCycle; k++) {
        const row = await createCode(db, { name: p.recipientName, org: p.organisation, email: p.email, days: p.codeValidityDays, by: { id: null, name: "Auto-renewal" }, planId: p.id, cycleNo: c, now: when });
        await db.update(codes).set({ emailedAt: new Date(when.getTime() + 6e4) }).where(eq(codes.id, row.id));
      }
    }
  }
  console.log(`\n[seed] demo data created. Sign in with olivia.hart@vth.co.uk (admin) or james.whitfield@vth.co.uk (standard), password: ${pw}\n`);
}
