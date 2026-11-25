

# VTH Thank You Spin
test@gmail.com
Test1234@
Customer spin site + staff portal, one Next.js 15 app on one PostgreSQL database.

```
npm install
npm run dev            # http://localhost:3000
```

Local dev needs **nothing else**: with no `DATABASE_URL` it uses an embedded Postgres (PGlite, stored in `./.data`) and seeds demo data on first run.
Demo staff (password `VthDemo2026!`): `olivia.hart@vth.co.uk` (admin), `james.whitfield@vth.co.uk` (standard).
Demo codes: `VTH-DEMO-VALD-2026` (valid) · `VTH-DEMO-EXPD-2026` · `VTH-DEMO-USED-2026`. To reset: stop the server and delete `.data/`.
`.env.local` sets `NEXT_PUBLIC_DEMO=1` to show the review guide and quick sign-in. **Never set that in production.**

## Architecture

| Layer | Choice |
|---|---|
| App | Next.js 15 (App Router), React 19, TypeScript |
| DB | PostgreSQL via Drizzle ORM (`lib/server/schema.ts`, SQL migrations in `drizzle/`) |
| Auth | Email + bcrypt, DB-backed HttpOnly session cookie, roles `admin` / `standard` |
| Email | SMTP (the client's own settings) -> Resend -> console + `email_log` (first one configured wins) |
| Bot protection | Cloudflare Turnstile (optional in dev) |
| Scheduled job | `/api/cron/renewals` (Vercel Cron, daily) for recurring plans |

Key code: `lib/server/codes.ts` (code engine + atomic redemption) · `lib/server/plans.ts` (recurring renewals) · `app/api/**` (routes) · `app/page.tsx` (customer flow) · `app/staff/**` (portal).

## Tests

```
npm run dev                      # in one terminal (fresh .data/)
BASE_URL=http://localhost:3000 npm run test:api    # 109 API checks
```
Covers: concurrent-spin race, recovery after a lost response, two-spin codes (spin again voids the first prize, accept is final), forged/missing passes, CSRF, role enforcement, server-side expiry rules, recurring plans (all frequencies, bulk), bulk code actions, uploads, legal pages, invites/resets, brute-force lockout.

## Production deployment (Vercel + Neon)

1. Create a managed Postgres (Neon / Supabase) → copy the connection string.
2. Import this repo in Vercel. Set env vars from `.env.example`:
   `DATABASE_URL`, `AUTO_MIGRATE=true` (or run `npm run db:migrate` in CI), `APP_URL`, `APP_SECRET`, `RATE_SALT`, `CRON_SECRET`,
   `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` (or `RESEND_API_KEY`), `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`,
   `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` (first admin; remove afterwards).
   Do **not** set `NEXT_PUBLIC_DEMO` or `SEED_DEMO`.
3. Make sure `EMAIL_FROM` is an address the SMTP account may send as (ask VTH to add SPF/DKIM for the sending domain).
   **Schema changes:** run `npm run db:migrate` against Neon (Direct connection string) BEFORE deploying a version that adds migrations.
4. `vercel.json` already registers the daily renewal cron. Vercel sends `Authorization: Bearer $CRON_SECRET`.
5. Point the domain (e.g. `spin.vth.co.uk`) via Cloudflare DNS.
6. Staging only: `DATABASE_URL=… npm run db:seed` loads demo data (refuses in production).

## Embedding in the VTH website

Add the VTH site's origin to `EMBED_ALLOWED_ORIGINS` (read at **build** time, so redeploy after changing it), then on the VTH page:

```html
<iframe id="vth-spin" src="https://spin.vth.co.uk/?embed=1" style="width:100%;border:0;min-height:700px" title="Thank You Spin"></iframe>
<script>
  window.addEventListener("message", function (e) {
    if (e.origin === "https://spin.vth.co.uk" && e.data && e.data.type === "vth-spin-height")
      document.getElementById("vth-spin").style.height = e.data.height + "px";
  });
</script>
```
A plain link to the site works without any of this.

## Recurring spins

Admin → **Recurring spins**. A plan issues ONE fresh unique code every day / week / fortnight / month / year (1 or 2 spins on it) and emails it automatically.
An unused code expires when the next allocation is due. A plan can run ongoing, N times or until a date; be paused, resumed, cancelled or issued early; and be created for many people at once (paste rows) and cancelled in bulk.

**Two-spin codes:** after the first spin the client either *accepts* the prize or *spins again*, which voids the first prize (the second is final). Accepting notifies the admin portal; a prize left un-accepted is accepted automatically when the code expires (daily job).

## Prizes, legal pages

Admin → **Reward settings**: name, description and an image (upload) or video (YouTube/Vimeo/.mp4 link) per prize; clicking a section on the wheel opens a pop-up with them.
Admin → **Legal pages**: Terms, Privacy and Prize Rules (paste text, optional PDF); public at `/legal/<page>` with share / download / print.

## Not built yet

Data-retention purge job · staff password self-service ("forgot password" is admin-triggered) · server-side pagination of very large code lists · external CRM integration (allocations are made in the admin portal; awaiting VTH's answer on what they meant by "from the CRM").
