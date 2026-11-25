import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { ApiError, body, json, route } from "@/lib/server/http";
import { rewards } from "@/lib/server/schema";
import { toReward } from "@/lib/server/serialize";
import { logActivity } from "@/lib/server/settings";

const ICONS = ["coins", "user", "percent", "zap", "gem", "arrowUp", "users", "sparkles", "video", "award", "crown", "armchair"] as const;
const schema = z.object({
  name: z.string().trim().min(1).max(48),
  label: z.string().trim().min(1).max(40).refine((l) => { const p = l.split("|"); return p.length <= 2 && p.every((x) => x.length <= 14); }, "Label must be at most 2 lines of 14 characters"),
  desc: z.string().trim().max(400),
  icon: z.enum(ICONS),
  mediaType: z.enum(["image", "video"]).nullable().optional(),
  mediaUrl: z.string().trim().max(500).nullable().optional(),
}).superRefine((d, ctx) => {
  if (!d.mediaType || !d.mediaUrl) return;
  const ok = d.mediaType === "image" ? /^(https:\/\/\S+|\/api\/media\/[0-9a-f-]{36})$/i.test(d.mediaUrl) : /^https:\/\/\S+$/i.test(d.mediaUrl);
  if (!ok) ctx.addIssue({ code: "custom", path: ["mediaUrl"], message: d.mediaType === "image" ? "Use an uploaded image or an https:// image link" : "Use an https:// video link (YouTube, Vimeo or an .mp4 file)" });
});

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const me = await requireUser("admin");
  const id = Number((await params).id);
  const d = await body(req, schema);
  const db = await getDb();
  const [r] = await db.update(rewards).set({ name: d.name, label: d.label, description: d.desc, icon: d.icon, mediaType: d.mediaUrl ? d.mediaType ?? null : null, mediaUrl: d.mediaUrl || null, updatedAt: new Date() }).where(eq(rewards.id, id)).returning();
  if (!r) throw new ApiError(404, "Reward not found");
  await logActivity(db, me.name, `Edited reward section ${id} (${d.name})`, "reward", me.id);
  return json({ reward: toReward(r) });
});
