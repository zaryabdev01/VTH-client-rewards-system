import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { ApiError, body, json, route } from "@/lib/server/http";
import { sessions, users } from "@/lib/server/schema";
import { toMember } from "@/lib/server/serialize";
import { logActivity } from "@/lib/server/settings";

const schema = z.object({ role: z.enum(["admin", "standard"]).optional(), active: z.boolean().optional() });

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const me = await requireUser("admin");
  const { id } = await params;
  const d = await body(req, schema);
  const db = await getDb();
  const [target] = await db.select().from(users).where(eq(users.id, id));
  if (!target) throw new ApiError(404, "Member not found");

  // Never allow the portal to be left without an active admin.
  const losesAdmin = target.role === "admin" && target.active && ((d.role && d.role !== "admin") || d.active === false);
  if (losesAdmin) {
    const admins = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.active, true)));
    if (admins.length <= 1) throw new ApiError(409, "There must be at least one active admin");
  }
  const [u] = await db.update(users).set({ ...(d.role ? { role: d.role } : {}), ...(d.active !== undefined ? { active: d.active } : {}) }).where(eq(users.id, id)).returning();
  if (d.active === false) await db.delete(sessions).where(eq(sessions.userId, id)); // deactivation signs them out immediately
  await logActivity(db, me.name, d.role ? `Changed ${u.name} to ${d.role}` : `${d.active ? "Re-activated" : "Deactivated"} ${u.name}`, "reward", me.id);
  return json({ member: toMember(u) });
});
