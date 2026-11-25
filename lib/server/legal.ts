import { eq } from "drizzle-orm";
import { DEFAULT_LEGAL, type LegalDoc } from "../shared";
import type { DB } from "./db";
import { settings } from "./schema";

export async function loadLegal(db: DB): Promise<LegalDoc[]> {
  const [r] = await db.select().from(settings).where(eq(settings.key, "legal"));
  const saved = (r?.value as Record<string, Partial<LegalDoc>> | undefined) ?? {};
  return DEFAULT_LEGAL.map((d) => ({ ...d, ...(saved[d.slug] ?? {}), slug: d.slug }));
}

export async function saveLegal(db: DB, slug: string, doc: Pick<LegalDoc, "title" | "body" | "pdfUrl">): Promise<LegalDoc[]> {
  const docs = await loadLegal(db);
  const next = Object.fromEntries(docs.map((x) => [x.slug, x.slug === slug
    ? { title: doc.title, body: doc.body, pdfUrl: doc.pdfUrl, updatedAt: new Date().toISOString() }
    : { title: x.title, body: x.body, pdfUrl: x.pdfUrl, updatedAt: x.updatedAt }]));
  await db.insert(settings).values({ key: "legal", value: next }).onConflictDoUpdate({ target: settings.key, set: { value: next } });
  return loadLegal(db);
}
