import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { ApiError, json, route } from "@/lib/server/http";
import { sendSetPasswordLink } from "@/lib/server/invites";
import { users } from "@/lib/server/schema";
import { logActivity } from "@/lib/server/settings";

/**
 * Admin: email a staff member a fresh one-time, 72-hour link. For someone who hasn't accepted their invite yet this
 * RESENDS the invite (older links stop working); for an existing user it is a password reset (the old password keeps
 * working until they choose a new one).
 */
export const POST = route<{ id: string }>(async (_req, { params }) => {
  const me = await requireUser("admin");
  const { id } = await params;
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u || !u.active) throw new ApiError(404, "Active team member not found");
  const pending = !u.passwordHash;
  const sent = await sendSetPasswordLink(db, u, me.name, { reset: !pending });
  await logActivity(db, me.name, `${pending ? "Resent the invite to" : "Sent a password reset link to"} ${u.name}${sent.delivered ? "" : " (email not sent, link shared manually)"}`, "reward", me.id);
  return json({ ok: true, pending, emailed: sent.delivered, ...(sent.devInviteUrl ? { devInviteUrl: sent.devInviteUrl } : {}) });
});
