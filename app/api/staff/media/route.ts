import { requireUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { ApiError, json, route } from "@/lib/server/http";
import { media } from "@/lib/server/schema";
import { logActivity } from "@/lib/server/settings";

const MAX = 3 * 1024 * 1024; // keep under the serverless request limit once base64-ed

/** Identify the file from its bytes, never from the claimed type (no SVG/HTML: those can carry scripts). */
function sniff(b: Buffer): string | null {
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (b.length > 6 && ["GIF87a", "GIF89a"].includes(b.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (b.length > 5 && b.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  return null;
}

/** Admin: upload a prize image (PNG/JPG/WebP/GIF) or a legal PDF, max 3 MB. Returns the public URL. */
export const POST = route(async (req) => {
  const me = await requireUser("admin");
  let file: File | null = null;
  try { const f = (await req.formData()).get("file"); file = f instanceof File ? f : null; } catch { /* handled below */ }
  if (!file) throw new ApiError(400, "Choose a file to upload");
  if (file.size > MAX) throw new ApiError(413, "That file is too large. The limit is 3 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf);
  if (!mime) throw new ApiError(415, "Only PNG, JPG, WebP, GIF images or PDF files can be uploaded");
  const db = await getDb();
  const [m] = await db.insert(media).values({ mime, name: file.name.slice(0, 120), size: buf.length, data: buf.toString("base64") }).returning({ id: media.id });
  await logActivity(db, me.name, `Uploaded ${mime === "application/pdf" ? "a PDF" : "an image"} (${file.name.slice(0, 60)})`, "reward", me.id);
  return json({ url: `/api/media/${m.id}`, mime });
});
