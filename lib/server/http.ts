import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) { super(message); }
}

export const json = (data: unknown = { ok: true }, init?: ResponseInit) => NextResponse.json(data, init);
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function clientIp(req: Request) {
  const xf = req.headers.get("x-forwarded-for");
  return (xf?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}
/** Hash so raw IPs are never stored (UK GDPR data minimisation). */
export const ipKey = (req: Request) => sha256(`${process.env.RATE_SALT ?? "vth"}:${clientIp(req)}`).slice(0, 24);

/** Reject cross-site state-changing requests (CSRF) for cookie-authenticated routes. */
function assertSameOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser client (curl, cron)
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let ok = false;
  try { ok = new URL(origin).host === host; } catch { ok = false; }
  if (!ok && process.env.APP_URL) { try { ok = new URL(origin).host === new URL(process.env.APP_URL).host; } catch {} }
  if (!ok) throw new ApiError(403, "Cross-site request blocked");
}

export function toResponse(e: unknown) {
  if (e instanceof ApiError) return NextResponse.json({ error: e.message, ...e.extra }, { status: e.status });
  if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input", field: e.issues[0]?.path.join(".") }, { status: 400 });
  console.error("[api] unhandled", e);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

type Ctx<P> = { params: Promise<P> };
export function route<P = Record<string, never>>(fn: (req: Request, ctx: Ctx<P>) => Promise<Response>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try { assertSameOrigin(req); return await fn(req, ctx); } catch (e) { return toResponse(e); }
  };
}

export async function body<T>(req: Request, schema: { parse: (v: unknown) => T }): Promise<T> {
  let raw: unknown;
  try { raw = await req.json(); } catch { throw new ApiError(400, "Invalid request body"); }
  return schema.parse(raw);
}
