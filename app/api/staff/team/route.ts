import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { sendSetPasswordLink } from "@/lib/server/invites";
import { ApiError, body, json, route } from "@/lib/server/http";
import { users } from "@/lib/server/schema";
import { toMember } from "@/lib/server/serialize";
import { logActivity } from "@/lib/server/settings";

const schema = z.object({ name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(200), role: z.enum(["admin", "standard"]) });

/** Invite a staff member: creates the account with no password and emails a 72-hour set-password link. */
export const POST = route(async (req) => {
  const me = await requireUser("admin");
  const d = await body(req, schema);
  const db = await getDb();
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.email})`, d.email.toLowerCase()));
  if (exists) throw new ApiError(409, "A team member with that email already exists");
  const [u] = await db.insert(users).values({ name: d.name, email: d.email.toLowerCase(), role: d.role }).returning();
  const sent = await sendSetPasswordLink(db, u, me.name);
  await logActivity(db, me.name, `Invited ${u.name} as ${u.role}${sent.delivered ? "" : " (email not sent, link shared manually)"}`, "reward", me.id);
  const [fresh] = await db.select().from(users).where(eq(users.id, u.id));
  return json({ member: toMember(fresh), emailed: sent.delivered, ...(sent.devInviteUrl ? { devInviteUrl: sent.devInviteUrl } : {}) });
});
