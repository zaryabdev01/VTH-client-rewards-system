import { getDb } from "@/lib/server/db";
import { ApiError, json, route } from "@/lib/server/http";
import { runDuePlans } from "@/lib/server/plans";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily job (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`). Issues + emails every due recurring cycle. */
async function handler(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret ? req.headers.get("authorization") !== `Bearer ${secret}` : process.env.NODE_ENV === "production") throw new ApiError(401, "Unauthorized");
  return json({ ok: true, ...(await runDuePlans(await getDb())) });
}
export const GET = route(handler);
export const POST = route(handler);
