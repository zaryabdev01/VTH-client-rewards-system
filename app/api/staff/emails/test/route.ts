import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { codeEmail, recurringEmail, rewardEmail, sendEmail } from "@/lib/server/email";
import { getDb } from "@/lib/server/db";
import { ApiError, body, json, route } from "@/lib/server/http";
import { getTemplates } from "@/lib/server/settings";

export const POST = route(async (req) => {
  const me = await requireUser();
  const { kind } = await body(req, z.object({ kind: z.enum(["code", "reward", "recurring"]) }));
  const db = await getDb();
  const t = await getTemplates(db);
  const expiresAt = new Date(Date.now() + 14 * 864e5);
  const built = kind === "code" ? codeEmail(t, { name: "Sarah Mitchell", code: "VTH-TEST-CODE-0000", expiresAt })
    : kind === "reward" ? rewardEmail(t, { name: "Sarah Mitchell", reward: "£25 Learning Credit", ref: "REF-TEST0000" })
    : recurringEmail(t, { name: "Sarah Mitchell", codes: ["VTH-TEST-CODE-0001", "VTH-TEST-CODE-0002"], expiresAt });
  const ok = await sendEmail(db, { to: me.email, kind: `test-${kind}`, ...built, subject: `[TEST] ${built.subject}` });
  if (!ok) throw new ApiError(502, "The test email could not be sent");
  return json({ ok: true, to: me.email });
});
