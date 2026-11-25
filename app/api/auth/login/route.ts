import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createSession, hashPassword, toUserDto, verifyPassword } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { ApiError, body, ipKey, json, route } from "@/lib/server/http";
import { clearFailures, lockRemaining, registerFailure } from "@/lib/server/ratelimit";
import { users } from "@/lib/server/schema";

export const dynamic = "force-dynamic";
const schema = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });
let DUMMY: Promise<string> | null = null;

export const POST = route(async (req) => {
  const { email, password } = await body(req, schema);
  const db = await getDb();
  const key = `login:${ipKey(req)}:${email.toLowerCase()}`;
  const wait = await lockRemaining(db, key);
  if (wait > 0) throw new ApiError(429, `Too many failed attempts. Try again in ${Math.ceil(wait / 60)} minute(s).`, { retryAfter: wait });

  const [u] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email.toLowerCase()));
  // Always run a bcrypt compare so response time doesn't reveal whether the email exists.
  const hash = u?.passwordHash ?? (await (DUMMY ??= hashPassword("not-a-real-password")));
  const ok = await verifyPassword(password, hash);
  if (!u || !u.passwordHash || !u.active || !ok) {
    await registerFailure(db, key, 5, 300);
    throw new ApiError(401, "Incorrect email or password");
  }
  await clearFailures(db, key);
  await createSession(u.id);
  await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, u.id));
  return json({ user: toUserDto(u) });
});
