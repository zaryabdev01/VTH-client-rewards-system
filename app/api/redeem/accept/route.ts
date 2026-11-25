import { after } from "next/server";
import { z } from "zod";
import { acceptPrize, emailReward, maskEmail } from "@/lib/server/codes";
import { getDb } from "@/lib/server/db";
import { ApiError, body, ipKey, json, route } from "@/lib/server/http";
import { hit } from "@/lib/server/ratelimit";

export const dynamic = "force-dynamic";
const schema = z.object({ code: z.string().min(1).max(40), claimToken: z.string().min(16).max(100) });

/** The holder of a 2-spin code accepts their current prize. It becomes final, the reward email is sent and staff are notified. */
export const POST = route(async (req) => {
  const { code, claimToken } = await body(req, schema);
  const db = await getDb();
  if ((await hit(db, `acc:${ipKey(req)}`, 60)) > 20) throw new ApiError(429, "Too many requests. Please slow down.");
  const r = await acceptPrize(db, code, claimToken);
  if (!r.ok) return json({ ok: false, reason: r.reason }, { status: r.reason === "invalid" ? 404 : 409 });
  if (!r.restored) after(() => emailReward(db, r).catch((e) => console.error("[email] reward", e)));
  return json({ ok: true, restored: r.restored, reward: r.reward, ref: r.ref, firstName: r.firstName, maskedEmail: maskEmail(r.email), final: true, canRespin: false, spinsAllowed: r.spinsAllowed, spinsUsed: r.spinsUsed });
});
