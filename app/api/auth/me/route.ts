import { currentUser, toUserDto } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const GET = route(async () => {
  const u = await currentUser();
  return u ? json({ user: toUserDto(u) }) : json({ user: null }, { status: 401 });
});
