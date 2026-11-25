import { NextResponse, type NextRequest } from "next/server";

/** Cheap gate: staff pages need a session cookie. Real validation happens in every API route. */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const open = pathname === "/staff/login" || pathname === "/staff/accept";
  if (pathname.startsWith("/staff") && !open && !req.cookies.get("vth_session")) {
    const url = req.nextUrl.clone(); url.pathname = "/staff/login"; url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/staff/:path*"] };
