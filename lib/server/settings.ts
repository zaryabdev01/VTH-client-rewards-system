import { eq } from "drizzle-orm";
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATES, type Settings, type Templates } from "../shared";
import type { DB } from "./db";
import { activity, settings } from "./schema";

type Q = Pick<DB, "select" | "insert">;

export async function getSettings(db: Q): Promise<Settings> {
  const [r] = await db.select().from(settings).where(eq(settings.key, "portal"));
  return { ...DEFAULT_SETTINGS, ...((r?.value as Partial<Settings>) ?? {}) };
}
export async function getTemplates(db: Q): Promise<Templates> {
  const [r] = await db.select().from(settings).where(eq(settings.key, "templates"));
  return { ...DEFAULT_TEMPLATES, ...((r?.value as Partial<Templates>) ?? {}) };
}
export async function putSetting(db: Q, key: "portal" | "templates", value: unknown) {
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

/** Append to the audit trail. Accepts a transaction so the entry commits with the change it describes. */
export async function logActivity(db: Q, who: string, text: string, kind: "code" | "email" | "spin" | "reward" | "fulfil" | "plan", actorId?: string | null) {
  await db.insert(activity).values({ actorName: who, actorId: actorId ?? null, text, kind });
}
