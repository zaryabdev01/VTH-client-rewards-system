import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { appUrl, inviteEmail, sendEmail } from "@/lib/server/email";
import { ApiError, body, json, route, sha256 } from "@/lib/server/http";
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
  const token = randomBytes(32).toString("base64url");
  const [u] = await db.insert(users).values({ name: d.name, email: d.email.toLowerCase(), role: d.role, inviteTokenHash: sha256(token), inviteExpiresAt: new Date(Date.now() + 72 * 36e5), invitedAt: new Date() }).returning();
  const url = `${appUrl()}/staff/accept?token=${token}`;
  await sendEmail(db, { to: u.email, kind: "invite", ...inviteEmail({ name: u.name, inviter: me.name, url }) });
  await logActivity(db, me.name, `Invited ${u.name} as ${u.role}`, "reward", me.id);
  return json({ member: toMember(u), ...(process.env.RESEND_API_KEY ? {} : { devInviteUrl: url }) });
});
