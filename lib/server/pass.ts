import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Short-lived signed token proving a code passed /check (and Turnstile) so /spin can't be hit directly. */
const g = globalThis as unknown as { __vthSecret?: string };
const secret = () => process.env.APP_SECRET ?? (g.__vthSecret ??= randomBytes(32).toString("hex"));
const sign = (p: string) => createHmac("sha256", secret()).update(p).digest("base64url");

export function signPass(normCode: string, ttlSec = 600) {
  const p = Buffer.from(JSON.stringify({ c: normCode, e: Date.now() + ttlSec * 1000 })).toString("base64url");
  return `${p}.${sign(p)}`;
}
export function verifyPass(pass: string | undefined, normCode: string) {
  if (!pass) return false;
  const [p, s] = pass.split(".");
  if (!p || !s) return false;
  const expect = sign(p);
  if (s.length !== expect.length || !timingSafeEqual(Buffer.from(s), Buffer.from(expect))) return false;
  try { const j = JSON.parse(Buffer.from(p, "base64url").toString()); return j.c === normCode && j.e > Date.now(); } catch { return false; }
}
