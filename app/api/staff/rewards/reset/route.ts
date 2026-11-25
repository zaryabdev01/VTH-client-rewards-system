import { requireUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";
import { rewards } from "@/lib/server/schema";
import { toReward } from "@/lib/server/serialize";
import { logActivity } from "@/lib/server/settings";
import { DEFAULT_REWARDS } from "@/lib/shared";

export const POST = route(async () => {
  const me = await requireUser("admin");
  const db = await getDb();
  for (const r of DEFAULT_REWARDS) await db.insert(rewards).values({ id: r.id, label: r.label, name: r.name, description: r.desc, icon: r.icon }).onConflictDoUpdate({ target: rewards.id, set: { label: r.label, name: r.name, description: r.desc, icon: r.icon, mediaType: null, mediaUrl: null, updatedAt: new Date() } });
  await logActivity(db, me.name, "Reset all reward sections to defaults", "reward", me.id);
  return json({ rewards: (await db.select().from(rewards).orderBy(rewards.id)).map(toReward) });
});
