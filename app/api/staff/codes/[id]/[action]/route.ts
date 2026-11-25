import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/server/auth";
import { emailCode } from "@/lib/server/codes";
import { getDb } from "@/lib/server/db";
import { ApiError, json, route } from "@/lib/server/http";
import { codes } from "@/lib/server/schema";
import { toCode } from "@/lib/server/serialize";
import { logActivity } from "@/lib/server/settings";

export const POST = route<{ id: string; action: string }>(async (_req, { params }) => {
  const { id, action } = await params;
  const me = await requireUser();
  const db = await getDb();
  const [row] = await db.select().from(codes).where(eq(codes.id, id));
  if (!row) throw new ApiError(404, "Code not found");

  if (action === "send") {
    if (row.status !== "active") throw new ApiError(409, "Only active codes can be emailed");
    if (!row.email) throw new ApiError(400, "This code has no email address");
    const ok = await emailCode(db, row, me.name);
    if (!ok) throw new ApiError(502, "The email could not be sent. Please try again.");
  } else if (action === "cancel") {
    const [u] = await db.update(codes).set({ status: "cancelled" }).where(and(eq(codes.id, id), eq(codes.status, "active"))).returning();
    if (!u) throw new ApiError(409, "Only active codes can be cancelled");
    await logActivity(db, me.name, `Cancelled code ${row.code}`, "code", me.id);
  } else if (action === "fulfil") {
    const [u] = await db.update(codes).set({ fulfilment: "fulfilled", fulfilledAt: new Date(), fulfilledByName: me.name }).where(and(eq(codes.id, id), eq(codes.status, "used"))).returning();
    if (!u) throw new ApiError(409, "Only redeemed rewards can be marked fulfilled");
    await logActivity(db, me.name, `Marked reward fulfilled for ${row.recipientName}`, "fulfil", me.id);
  } else throw new ApiError(404, "Unknown action");

  const [fresh] = await db.select().from(codes).where(eq(codes.id, id));
  return json({ code: toCode(fresh) });
});
