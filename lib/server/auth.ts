import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import type { User as UserDto } from "../shared";
import { getDb } from "./db";
import { ApiError, sha256 } from "./http";
import { sessions, users, type User } from "./schema";

const COOKIE = "vth_session";
const SESSION_HOURS = 8;

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const verifyPassword = (p: string, hash: string) => bcrypt.compare(p, hash);
export const initials = (name: string) => name.split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
export const toUserDto = (u: User): UserDto => ({ id: u.id, name: u.name, email: u.email, role: u.role, initials: initials(u.name) });

export function validatePassword(p: string) {
  if (p.length < 10) throw new ApiError(400, "Password must be at least 10 characters");
  if (!/[a-z]/i.test(p) || !/\d/.test(p)) throw new ApiError(400, "Password needs letters and at least one number");
}

export async function createSession(userId: string) {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 36e5);
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) { const db = await getDb(); await db.delete(sessions).where(eq(sessions.id, sha256(token))); }
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const rows = await db.select({ u: users }).from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date()), eq(users.active, true))).limit(1);
  return rows[0]?.u ?? null;
}

export async function requireUser(role?: "admin"): Promise<User> {
  const u = await currentUser();
  if (!u) throw new ApiError(401, "Please sign in");
  if (role === "admin" && u.role !== "admin") throw new ApiError(403, "Only admins can do that");
  return u;
}
