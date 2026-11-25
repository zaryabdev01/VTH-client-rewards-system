import { z } from "zod";
import { checkCode, maskEmail, restoreCode } from "@/lib/server/codes";
import { getDb } from "@/lib/server/db";
import { ApiError, body, clientIp, ipKey, json, route } from "@/lib/server/http";
import { signPass } from "@/lib/server/pass";
import { hit, lockRemaining, registerFailure } from "@/lib/server/ratelimit";
import { verifyTurnstile } from "@/lib/server/turnstile";
import { normaliseCode } from "@/lib/shared";

export const dynamic = "force-dynamic";
const schema = z.object({ code: z.string().min(1).max(40), claimToken: z.string().max(100).optional(), turnstile: z.string().max(4096).optional() });

/**
 * Step 1 of the customer flow. Does NOT consume the code. Protected by: per-IP rate limit, a failure lock
 * (5 wrong codes -> 30s), and Cloudflare Turnstile when configured. Returns a signed pass required by /spin.
 */
export const POST = route(async (req) => {
  const { code, claimToken, turnstile } = await body(req, schema);
  const db = await getDb();
  const ip = ipKey(req);

  const locked = await lockRemaining(db, `fail:${ip}`);
  if (locked > 0) throw new ApiError(429, `Too many attempts. Please wait ${locked} seconds.`, { reason: "limit", retryAfter: locked });
  if ((await hit(db, `chk:${ip}`, 60)) > 30) throw new ApiError(429, "Too many requests. Please slow down.", { reason: "limit", retryAfter: 60 });

  // A returning browser recovers its original result (no Turnstile needed: the claim token is a secret).
  if (claimToken) {
    const back = await restoreCode(db, code, claimToken);
    if (back) return json({ ok: true, restored: true, firstName: back.firstName, reward: back.reward, ref: back.ref, maskedEmail: maskEmail(back.email), final: back.final, canRespin: back.canRespin, spinsAllowed: back.spinsAllowed, spinsUsed: back.spinsUsed });
  }

  if (!(await verifyTurnstile(turnstile, clientIp(req)))) throw new ApiError(403, "Verification failed. Please refresh and try again.", { reason: "bot" });

  const r = await checkCode(db, code);
  if (!r.ok) {
    if (r.reason === "invalid") {
      const lock = await registerFailure(db, `fail:${ip}`, 5, 30);
      if (lock) throw new ApiError(429, `Too many attempts. Please wait ${lock} seconds.`, { reason: "limit", retryAfter: lock });
    }
    return json({ ok: false, reason: r.reason, expiresAt: r.expiresAt?.toISOString() });
  }
  return json({ ok: true, restored: false, firstName: r.firstName, spins: r.spins, pass: signPass(normaliseCode(code)) });
});
