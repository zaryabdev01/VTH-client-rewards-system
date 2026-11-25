import { eq, sql } from "drizzle-orm";
import type { DB } from "./db";
import { rateLimits } from "./schema";

/** Fixed-window counter. Returns the new count in the current window. */
export async function hit(db: DB, key: string, windowSec: number): Promise<number> {
  const r = await db.execute(sql`
    INSERT INTO rate_limits (key, count, window_start) VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start < now() - (${windowSec}::double precision * interval '1 second') THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start < now() - (${windowSec}::double precision * interval '1 second') THEN now() ELSE rate_limits.window_start END
    RETURNING count`);
  return Number((r.rows[0] as { count: number }).count);
}

/** Seconds remaining on a lock (0 = not locked). */
export async function lockRemaining(db: DB, key: string): Promise<number> {
  const [r] = await db.select().from(rateLimits).where(eq(rateLimits.key, key));
  if (!r?.lockedUntil) return 0;
  return Math.max(0, Math.ceil((r.lockedUntil.getTime() - Date.now()) / 1000));
}

/** Count a failed attempt; after `max` failures inside 10 minutes, lock for `lockSec`. Returns lock seconds if now locked. */
export async function registerFailure(db: DB, key: string, max = 5, lockSec = 30): Promise<number> {
  const [r] = await db.select().from(rateLimits).where(eq(rateLimits.key, key));
  const fresh = !r || Date.now() - r.windowStart.getTime() > 10 * 60_000;
  const count = fresh ? 1 : r.count + 1;
  const lock = count >= max;
  const values = { key, count: lock ? 0 : count, windowStart: fresh ? new Date() : r.windowStart, lockedUntil: lock ? new Date(Date.now() + lockSec * 1000) : (r?.lockedUntil ?? null) };
  await db.insert(rateLimits).values(values).onConflictDoUpdate({ target: rateLimits.key, set: values });
  return lock ? lockSec : 0;
}

export async function clearFailures(db: DB, key: string) {
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}
