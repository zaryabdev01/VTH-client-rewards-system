import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { appUrl, inviteEmail, sendEmail } from "@/lib/server/email";
import { ApiError, json, route, sha256 } from "@/lib/server/http";
import { users } from "@/lib/server/schema";
import { logActivity } from "@/lib/server/settings";

/** Admin: email a staff member a one-time, 72-hour link to choose a new password. The old password keeps working until they do. */
export const POST = route<{ id: string }>(async (_req, { params }) => {
  const me = await requireUser("admin");
  const { id } = await params;
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u || !u.active) throw new ApiError(404, "Active team member not found");
  const token = randomBytes(32).toString("base64url");
  await db.update(users).set({ inviteTokenHash: sha256(token), inviteExpiresAt: new Date(Date.now() + 72 * 36e5) }).where(eq(users.id, id));
  const url = `${appUrl()}/staff/accept?token=${token}`;
  await sendEmail(db, { to: u.email, kind: "reset", ...inviteEmail({ name: u.name, inviter: me.name, url, reset: true }) });
  await logActivity(db, me.name, `Sent a password reset link to ${u.name}`, "reward", me.id);
  return json({ ok: true, ...(process.env.RESEND_API_KEY ? {} : { devInviteUrl: url }) });
});
