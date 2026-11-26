import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { DB } from "./db";
import { appUrl, emailMode, inviteEmail, sendEmail } from "./email";
import { sha256 } from "./http";
import { users, type User } from "./schema";

/**
 * Issue a fresh single-use 72-hour set-password link for a user (new invite, resent invite, or password reset)
 * and email it. `delivered` is false when no email provider is configured or sending failed; the link is then
 * returned so the admin can pass it on by hand. (Only ever returned to an authenticated admin.)
 */
export async function sendSetPasswordLink(db: DB, u: User, inviter: string, opts: { reset?: boolean } = {}) {
  const token = randomBytes(32).toString("base64url");
  await db.update(users).set({ inviteTokenHash: sha256(token), inviteExpiresAt: new Date(Date.now() + 72 * 36e5), ...(opts.reset ? {} : { invitedAt: new Date() }) }).where(eq(users.id, u.id));
  const url = `${appUrl()}/staff/accept?token=${token}`;
  const ok = await sendEmail(db, { to: u.email, kind: opts.reset ? "reset" : "invite", ...inviteEmail({ name: u.name, inviter, url, reset: opts.reset }) });
  const delivered = ok && emailMode() !== "log";
  return { delivered, ...(delivered ? {} : { devInviteUrl: url }) };
}
