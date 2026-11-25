import { eq } from "drizzle-orm";
import { getDb } from "@/lib/server/db";
import { ApiError, route } from "@/lib/server/http";
import { media } from "@/lib/server/schema";

export const dynamic = "force-dynamic";

/** Public: serve an uploaded prize image / legal PDF. Ids are random UUIDs and content never changes, so it caches forever. */
export const GET = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "Not found");
  const db = await getDb();
  const [m] = await db.select().from(media).where(eq(media.id, id));
  if (!m) throw new ApiError(404, "Not found");
  return new Response(Buffer.from(m.data, "base64"), {
    headers: {
      "Content-Type": m.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${m.name.replace(/[^\w.\- ]/g, "_") || "file"}"`,
    },
  });
});
