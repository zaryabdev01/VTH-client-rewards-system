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
  desc: z.string().trim().max(140),
  icon: z.enum(ICONS),
});

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const me = await requireUser("admin");
  const id = Number((await params).id);
  const d = await body(req, schema);
  const db = await getDb();
  const [r] = await db.update(rewards).set({ name: d.name, label: d.label, description: d.desc, icon: d.icon, updatedAt: new Date() }).where(eq(rewards.id, id)).returning();
  if (!r) throw new ApiError(404, "Reward not found");
  await logActivity(db, me.name, `Edited reward section ${id} (${d.name})`, "reward", me.id);
  return json({ reward: toReward(r) });
});
