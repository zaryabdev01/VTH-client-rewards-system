# VTH Thank You Spin

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
| Email | Resend (falls back to console + `email_log` table when no key) |
| Bot protection | Cloudflare Turnstile (optional in dev) |
| Scheduled job | `/api/cron/renewals` (Vercel Cron, daily) for recurring plans |

Key code: `lib/server/codes.ts` (code engine + atomic redemption) · `lib/server/plans.ts` (recurring renewals) · `app/api/**` (routes) · `app/page.tsx` (customer flow) · `app/staff/**` (portal).

## Tests

```
npm run dev                      # in one terminal (fresh .data/)
BASE_URL=http://localhost:3000 npm run test:api    # 55 API checks
```
Covers: concurrent-spin race, recovery after a lost response, forged/missing passes, CSRF, role enforcement, server-side expiry rules, recurring-plan lifecycle, invites/resets, brute-force lockout.

## Production deployment (Vercel + Neon)

1. Create a managed Postgres (Neon / Supabase) → copy the connection string.
2. Import this repo in Vercel. Set env vars from `.env.example`:
   `DATABASE_URL`, `AUTO_MIGRATE=true` (or run `npm run db:migrate` in CI), `APP_URL`, `APP_SECRET`, `RATE_SALT`, `CRON_SECRET`,
   `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`,
   `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` (first admin; remove afterwards).
   Do **not** set `NEXT_PUBLIC_DEMO` or `SEED_DEMO`.
3. Verify the sending domain in Resend (SPF + DKIM) before launch.
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

## Recurring spins (option 2)

Admin → **Recurring spins**. A plan issues 1 or 2 fresh one-time codes every week / fortnight / month and emails them automatically.
It can end after N renewals, on a date, or never; can be paused, resumed, cancelled or issued early. See `docs/DEFAULTS_AND_DECISIONS.md`.

## Not built yet

Data-retention purge job · staff password self-service ("forgot password" is admin-triggered) · server-side pagination of very large code lists · real VTH branding (pending brand guide).
