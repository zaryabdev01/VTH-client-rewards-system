import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { createCode, emailCode } from "@/lib/server/codes";
import { getDb } from "@/lib/server/db";
import { body, json, route } from "@/lib/server/http";
import { codes } from "@/lib/server/schema";
import { toCode } from "@/lib/server/serialize";
import { getSettings, logActivity } from "@/lib/server/settings";

const schema = z.object({
  name: z.string().trim().min(1, "Recipient name is required").max(120),
  org: z.string().trim().max(160).default(""),
  email: z.string().trim().email("Enter a valid email address").max(200).or(z.literal("")).default(""),
  days: z.number().int().min(1).max(365),
  spins: z.number().int().min(1).max(2).default(1),
  sendNow: z.boolean().default(false),
});

export const POST = route(async (req) => {
  const me = await requireUser();
  const d = await body(req, schema);
  const db = await getDb();
  const st = await getSettings(db);
  const days = me.role === "admin" || st.staffCanChangeExpiry ? d.days : st.defaultExpiry; // enforced server-side, not just in the UI
  const row = await createCode(db, { name: d.name, org: d.org, email: d.email || null, days, spins: d.spins, by: { id: me.id, name: me.name } });
  await logActivity(db, me.name, `Generated a ${d.spins === 2 ? "2-spin " : ""}code for ${d.name}${d.org ? ` (${d.org})` : ""}`, "code", me.id);
  let emailed = false;
  if (d.sendNow && row.email) emailed = await emailCode(db, row, me.name);
  const [fresh] = await db.select().from(codes).where(eq(codes.id, row.id));
  return json({ code: toCode(fresh), emailed });
});
