import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { createSession, hashPassword, toUserDto, validatePassword } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { ApiError, body, json, route, sha256 } from "@/lib/server/http";
import { users } from "@/lib/server/schema";
import { logActivity } from "@/lib/server/settings";

export const dynamic = "force-dynamic";

/** GET ?token= — validate an invite link. */
export const GET = route(async (req) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const db = await getDb();
  const [u] = await db.select().from(users).where(and(eq(users.inviteTokenHash, sha256(token)), gt(users.inviteExpiresAt, new Date())));
  if (!u) throw new ApiError(404, "This invitation link is invalid or has expired.");
  return json({ name: u.name, email: u.email });
});

/** POST — accept the invite by setting a password, then sign in. */
export const POST = route(async (req) => {
  const { token, password } = await body(req, z.object({ token: z.string().min(10).max(200), password: z.string().max(200) }));
  validatePassword(password);
  const db = await getDb();
  const [u] = await db.select().from(users).where(and(eq(users.inviteTokenHash, sha256(token)), gt(users.inviteExpiresAt, new Date())));
  if (!u) throw new ApiError(404, "This invitation link is invalid or has expired.");
  const [done] = await db.update(users).set({ passwordHash: await hashPassword(password), inviteTokenHash: null, inviteExpiresAt: null, lastActiveAt: new Date() }).where(eq(users.id, u.id)).returning();
  await logActivity(db, u.name, "Accepted their invitation", "reward", u.id);
  await createSession(u.id);
  return json({ user: toUserDto(done) });
});
