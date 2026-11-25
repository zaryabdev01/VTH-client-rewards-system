import { after } from "next/server";
import { z } from "zod";
import { emailReward, maskEmail, redeemCode, restoreCode, type Spin } from "@/lib/server/codes";
import { getDb } from "@/lib/server/db";
import { ApiError, body, ipKey, json, route } from "@/lib/server/http";
import { verifyPass } from "@/lib/server/pass";
import { hit } from "@/lib/server/ratelimit";
import { normaliseCode } from "@/lib/shared";

export const dynamic = "force-dynamic";
const view = (s: Spin) => ({ reward: s.reward, ref: s.ref, firstName: s.firstName, maskedEmail: maskEmail(s.email), final: s.final, canRespin: s.canRespin, spinsAllowed: s.spinsAllowed, spinsUsed: s.spinsUsed });
const schema = z.object({ code: z.string().min(1).max(40), pass: z.string().max(600).optional(), claimToken: z.string().max(100).optional(), respin: z.boolean().optional() });

/**
 * Step 2: spin. The prize is chosen HERE, on the server, with a CSPRNG, and recorded atomically with the code being
 * marked used. The browser only animates the wheel to the result it is given.
 */
export const POST = route(async (req) => {
  const { code, pass, claimToken, respin } = await body(req, schema);
  const db = await getDb();
  if ((await hit(db, `spin:${ipKey(req)}`, 60)) > 20) throw new ApiError(429, "Too many requests. Please slow down.");

  const norm = normaliseCode(code);
  if (!verifyPass(pass, norm) && !(respin && claimToken)) { // a second spin is authorised by the claim secret, not a fresh pass
    // No valid pass: the only way in is recovering YOUR OWN earlier result with your claim secret.
    const back = claimToken ? await restoreCode(db, code, claimToken) : null;
    if (back) return json({ ok: true, restored: true, ...view(back) });
    throw new ApiError(403, "Please enter your code again to continue.", { reason: "pass" });
  }

  const r = await redeemCode(db, code, claimToken, respin === true && !!claimToken);
  if (!r.ok) return json({ ok: false, reason: r.reason, expiresAt: r.expiresAt?.toISOString() }, { status: r.reason === "invalid" ? 404 : 409 });

  if (!r.restored && r.final) after(() => emailReward(db, r).catch((e) => console.error("[email] reward", e)));
  return json({ ok: true, restored: r.restored, claimToken: r.claimToken, ...view(r) });
});
