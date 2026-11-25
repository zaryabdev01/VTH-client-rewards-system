import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { body, json, route } from "@/lib/server/http";
import { getTemplates, logActivity, putSetting } from "@/lib/server/settings";

const t = z.string().trim().min(1).max(4000);
const schema = z.object({ codeSubject: t, codeBody: t, rewardSubject: t, rewardBody: t, recurringSubject: t, recurringBody: t, signOff: t });

export const PUT = route(async (req) => {
  const me = await requireUser("admin");
  const d = await body(req, schema);
  const db = await getDb();
  await putSetting(db, "templates", d);
  await logActivity(db, me.name, "Updated email templates", "reward", me.id);
  return json({ templates: await getTemplates(db) });
});
