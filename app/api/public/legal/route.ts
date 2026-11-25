import { json, route } from "@/lib/server/http";
import { getDb } from "@/lib/server/db";
import { loadLegal } from "@/lib/server/legal";

export const dynamic = "force-dynamic";

/** Public: the terms / privacy / prize-rules pages. VTH supplies the wording; admins edit it in the portal. */
export const GET = route(async () => json({ docs: await loadLegal(await getDb()) }));
