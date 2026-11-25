import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { emailCode } from "@/lib/server/codes";
import { getDb } from "@/lib/server/db";
import { body, json, route } from "@/lib/server/http";
import { codes } from "@/lib/server/schema";
import { logActivity } from "@/lib/server/settings";

const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500), action: z.enum(["cancel", "send"]) });

/** Mass actions on a hand-picked set of codes. Each code is checked individually; ones that don't qualify are skipped and counted. */
export const POST = route(async (req) => {
  const me = await requireUser();
  const { ids, action } = await body(req, schema);
  const db = await getDb();
  let done = 0;
  if (action === "cancel") {
    const rows = await db.update(codes).set({ status: "cancelled" }).where(and(inArray(codes.id, ids), eq(codes.status, "active"))).returning({ id: codes.id });
    done = rows.length;
    if (done) await logActivity(db, me.name, `Cancelled ${done} code${done === 1 ? "" : "s"} in bulk`, "code", me.id);
  } else {
    const rows = await db.select().from(codes).where(and(inArray(codes.id, ids), eq(codes.status, "active")));
    for (const r of rows) if (r.email && (await emailCode(db, r, me.name))) done++;
  }
  return json({ done, skipped: ids.length - done });
});
