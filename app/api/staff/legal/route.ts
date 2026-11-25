import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { body, json, route } from "@/lib/server/http";
import { saveLegal } from "@/lib/server/legal";
import { logActivity } from "@/lib/server/settings";
import { LEGAL_SLUGS } from "@/lib/shared";

const schema = z.object({
  slug: z.enum(LEGAL_SLUGS),
  title: z.string().trim().min(1).max(120),
  body: z.string().max(60000),
  pdfUrl: z.string().max(200).regex(/^\/api\/media\/[0-9a-f-]{36}$/i, "Invalid file").nullable().optional(),
});

/** Admin: replace the wording of one legal page (and optionally attach a PDF version to download). */
export const PUT = route(async (req) => {
  const me = await requireUser("admin");
  const d = await body(req, schema);
  const db = await getDb();
  const docs = await saveLegal(db, d.slug, { title: d.title, body: d.body, pdfUrl: d.pdfUrl ?? undefined });
  await logActivity(db, me.name, `Updated the “${d.title}” page`, "reward", me.id);
  return json({ docs });
});
