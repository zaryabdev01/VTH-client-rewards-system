import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { body, json, route } from "@/lib/server/http";
import { getSettings, logActivity, putSetting } from "@/lib/server/settings";

const schema = z.object({ defaultExpiry: z.number().int().min(1).max(365), staffCanChangeExpiry: z.boolean() });

export const PUT = route(async (req) => {
  const me = await requireUser("admin");
  const d = await body(req, schema);
  const db = await getDb();
  await putSetting(db, "portal", d);
  await logActivity(db, me.name, "Changed portal settings", "reward", me.id);
  return json({ settings: await getSettings(db) });
});
