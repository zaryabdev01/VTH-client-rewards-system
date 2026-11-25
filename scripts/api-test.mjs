const B = process.env.BASE_URL ?? "http://localhost:3000";
let pass = 0, fail = 0;
const t = (name, cond, extra = "") => { (cond ? pass++ : fail++); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  -> " + extra}`); };
const post = (path, data, headers = {}) => fetch(B + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(data) });
const J = async (r) => { const j = await r.json().catch(() => ({})); return { s: r.status, ...j }; };

async function login(email, password = "VthDemo2026!") {
  const r = await post("/api/auth/login", { email, password });
  const cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  return { r: await J(r), cookie };
}
const staff = (cookie) => ({
  get: async (p) => J(await fetch(B + p, { headers: { cookie } })),
  post: async (p, d, h = {}) => J(await post(p, d, { cookie, ...h })),
  patch: async (p, d, h = {}) => J(await fetch(B + p, { method: "PATCH", headers: { "content-type": "application/json", cookie, ...h }, body: JSON.stringify(d) })),
  put: async (p, d) => J(await fetch(B + p, { method: "PUT", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(d) })),
});

console.log("\n=== PUBLIC REDEMPTION ===");
let r = await J(await post("/api/redeem/check", { code: "VTH-ZZZZ-ZZZZ-ZZZZ" }));
t("unknown code -> invalid", r.ok === false && r.reason === "invalid", JSON.stringify(r));
r = await J(await post("/api/redeem/check", { code: "VTH-DEMO-EXPD-2026" }));
t("expired code -> expired + date", r.reason === "expired" && !!r.expiresAt, JSON.stringify(r));
r = await J(await post("/api/redeem/check", { code: "VTH-DEMO-USED-2026" }));
t("used code -> used", r.reason === "used", JSON.stringify(r));
r = await J(await post("/api/redeem/check", { code: "vth demo vald 2026" }));
t("valid code, messy input (lowercase/spaces) -> ok + pass + first name", r.ok === true && !!r.pass && r.firstName === "Sarah", JSON.stringify(r));
const pass1 = r.pass;

r = await J(await post("/api/redeem/spin", { code: "VTH-DEMO-VALD-2026" }));
t("spin without pass is rejected (403)", r.s === 403, JSON.stringify(r));
r = await J(await post("/api/redeem/spin", { code: "VTH-DEMO-VALD-2026", pass: "forged.pass" }));
t("spin with forged pass is rejected (403)", r.s === 403, JSON.stringify(r));

// RACE: 8 simultaneous spins (double-click / many tabs) must produce exactly ONE reward
const results = await Promise.all(Array.from({ length: 8 }, () => post("/api/redeem/spin", { code: "VTH-DEMO-VALD-2026", pass: pass1 }).then(J)));
const wins = results.filter((x) => x.ok);
t("8 concurrent spins -> exactly 1 reward", wins.length === 1, `wins=${wins.length}`);
t("the other 7 are refused as 'used'", results.filter((x) => x.reason === "used").length === 7);
const win = wins[0];
t("winner gets reward, ref and claim token", !!win?.reward?.name && /^REF-/.test(win?.ref) && !!win?.claimToken, JSON.stringify(win));
t("email is masked in the response", /\*/.test(win?.maskedEmail ?? ""), win?.maskedEmail);

r = await J(await post("/api/redeem/spin", { code: "VTH-DEMO-VALD-2026", pass: pass1 }));
t("spinning the same code again -> refused", r.s === 409 && r.reason === "used");
r = await J(await post("/api/redeem/check", { code: "VTH-DEMO-VALD-2026", claimToken: win.claimToken }));
t("dropped connection: SAME browser restores the ORIGINAL result", r.restored === true && r.ref === win.ref && r.reward.id === win.reward.id, JSON.stringify(r));
r = await J(await post("/api/redeem/spin", { code: "VTH-DEMO-VALD-2026", claimToken: win.claimToken }));
t("restore via /spin returns identical prize, no new reward", r.restored === true && r.ref === win.ref);
r = await J(await post("/api/redeem/check", { code: "VTH-DEMO-VALD-2026", claimToken: "wrong-token" }));
t("someone else with the code but wrong claim token -> 'used'", r.reason === "used");

console.log("\n=== STAFF AUTH ===");
let a = await login("olivia.hart@vth.co.uk", "wrong-password");
t("wrong password -> 401", a.r.s === 401);
a = await login("olivia.hart@vth.co.uk");
t("admin login OK, cookie is HttpOnly", a.r.user?.role === "admin" && !!a.cookie);
const admin = staff(a.cookie);
const s = await login("james.whitfield@vth.co.uk");
const std = staff(s.cookie);
t("anonymous bootstrap -> 401", (await J(await fetch(B + "/api/staff/bootstrap"))).s === 401);
const boot = await admin.get("/api/staff/bootstrap");
t("admin bootstrap returns codes/rewards/team/plans", boot.codes?.length > 15 && boot.rewards?.length === 12 && boot.team?.length === 4 && boot.plans?.length === 2, `codes=${boot.codes?.length} plans=${boot.plans?.length}`);
t("redeemed demo code now shows as used in the portal", boot.codes.find((c) => c.code === "VTH-DEMO-VALD-2026")?.status === "used");
t("deactivated user cannot sign in", (await login("daniel.cole@vth.co.uk")).r.s === 401);

console.log("\n=== ROLES & CSRF ===");
const rw = { name: "£10 Learning Credit", label: "£10 Learning|Credit", desc: "x", icon: "coins" };
t("standard staff cannot edit rewards (403)", (await std.patch("/api/staff/rewards/1", rw)).s === 403);
t("admin can edit a reward", (await admin.patch("/api/staff/rewards/1", { ...rw, desc: "Updated" })).reward?.desc === "Updated");
t("label longer than 14 chars is rejected (400)", (await admin.patch("/api/staff/rewards/1", { ...rw, label: "ThisLabelIsFarTooLong|X" })).s === 400);
t("standard staff cannot create recurring plans (403)", (await std.post("/api/staff/plans", { name: "X", email: "x@y.co", frequency: "weekly", spinsPerCycle: 1, codeValidityDays: 7 })).s === 403);
t("cross-site POST is blocked (CSRF)", (await admin.post("/api/staff/codes", { name: "Evil", days: 7 }, { origin: "https://evil.example" })).s === 403);
t("sole admin cannot demote themselves", (await admin.patch(`/api/staff/team/${boot.user.id}`, { role: "standard" })).s === 409);

console.log("\n=== CODES ===");
let c = await admin.post("/api/staff/codes", { name: "Test Client", org: "Acme", email: "test@acme.co.uk", days: 30, sendNow: true });
t("generate + send -> emailed", c.emailed === true && /^VTH-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c.code?.code) && !!c.code?.emailedAt, JSON.stringify(c).slice(0, 200));
t("invalid email rejected (400)", (await admin.post("/api/staff/codes", { name: "A", email: "not-an-email", days: 7 })).s === 400);
await admin.put("/api/staff/settings", { defaultExpiry: 14, staffCanChangeExpiry: false });
c = await std.post("/api/staff/codes", { name: "Std Client", days: 90 });
const days = Math.round((new Date(c.code.expiresAt) - new Date(c.code.createdAt)) / 864e5);
t("standard staff expiry override is enforced SERVER-side (asked 90 -> got 14)", days === 14, `days=${days}`);
const cx = await std.post(`/api/staff/codes/${c.code.id}/cancel`, {});
t("cancel a code", cx.code?.status === "cancelled");
r = await J(await post("/api/redeem/check", { code: c.code.code }));
t("cancelled code cannot be redeemed", r.reason === "cancelled");
const used = boot.codes.find((x) => x.status === "used" && x.fulfilment === "pending");
t("mark reward fulfilled", (await std.post(`/api/staff/codes/${used.id}/fulfil`, {})).code?.fulfilment === "fulfilled");

console.log("\n=== RECURRING PLANS (option 2: fresh code each period) ===");
let p = await admin.post("/api/staff/plans", { name: "Plan Person", org: "Recur Ltd", email: "plan@recur.co.uk", frequency: "monthly", spinsPerCycle: 2, codeValidityDays: 30, maxCycles: 3 });
t("plan created, first cycle issued immediately (2 spins = 2 fresh codes)", p.issued === 2 && p.plan?.cyclesDone === 1, JSON.stringify(p).slice(0, 220));
const b2 = await admin.get("/api/staff/bootstrap");
const planCodes = b2.codes.filter((x) => x.planId === p.plan.id);
t("two DISTINCT one-time codes linked to the plan", planCodes.length === 2 && planCodes[0].code !== planCodes[1].code && planCodes.every((x) => x.cycleNo === 1 && !!x.emailedAt));
const dueIn = new Date(p.plan.nextRunAt) - Date.now();
t("next cycle scheduled ~1 month ahead", dueIn > 27 * 864e5 && dueIn < 32 * 864e5, `${dueIn / 864e5}d`);
if (process.env.CRON_SECRET) {
  t("cron endpoint rejects callers without the secret (401)", (await fetch(B + "/api/cron/renewals")).status === 401);
  t("cron endpoint rejects a wrong secret (401)", (await fetch(B + "/api/cron/renewals", { headers: { authorization: "Bearer nope" } })).status === 401);
}
let cron = await J(await fetch(B + "/api/cron/renewals", { headers: process.env.CRON_SECRET ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : {} }));
t("cron runs and finds nothing due (idempotent)", cron.ok === true && cron.plansRun === 0, JSON.stringify(cron));
p = await admin.patch(`/api/staff/plans/${p.plan.id}`, { action: "issue-now" });
t("'issue now' issues cycle 2 early", p.issued === 2 && p.plan.cyclesDone === 2);
p = await admin.patch(`/api/staff/plans/${p.plan.id}`, { action: "issue-now" });
t("cycle 3 reaches max_cycles -> plan completes", p.plan.cyclesDone === 3 && p.plan.status === "completed", p.plan?.status);
t("completed plan can't issue more", (await admin.patch(`/api/staff/plans/${p.plan.id}`, { action: "issue-now" })).s === 409);
const q = await admin.post("/api/staff/plans", { name: "Pause Me", email: "pause@x.co.uk", frequency: "weekly", spinsPerCycle: 1, codeValidityDays: 7 });
t("pause", (await admin.patch(`/api/staff/plans/${q.plan.id}`, { action: "pause" })).plan.status === "paused");
t("resume", (await admin.patch(`/api/staff/plans/${q.plan.id}`, { action: "resume" })).plan.status === "active");
t("cancel", (await admin.patch(`/api/staff/plans/${q.plan.id}`, { action: "cancel" })).plan.status === "cancelled");

console.log("\n=== LOST-RESPONSE RECOVERY (browser-generated claim secret) ===");
{
  // A plan-issued code, redeemed with a claim secret the BROWSER made up before sending — then we pretend the response was lost.
  const fresh = planCodes[0].code;
  const chk = await J(await post("/api/redeem/check", { code: fresh }));
  const claim = "browserMadeSecret_0123456789abcdef";
  const sp = await J(await post("/api/redeem/spin", { code: fresh, pass: chk.pass, claimToken: claim }));
  t("spin with a browser-supplied claim secret succeeds", sp.ok === true && !!sp.ref, JSON.stringify(sp));
  // ...response lost; the browser never saw sp. It only knows its own secret:
  const rec = await J(await post("/api/redeem/check", { code: fresh, claimToken: claim }));
  t("browser recovers the SAME prize + reference from its own secret", rec.restored === true && rec.ref === sp.ref && rec.reward.id === sp.reward.id, JSON.stringify(rec));
  const other = await J(await post("/api/redeem/check", { code: fresh, claimToken: "someoneElsesSecret_0123456789abcdef" }));
  t("a different browser with the code but not the secret gets 'used'", other.reason === "used");
}

console.log("\n=== TEAM INVITES ===");
const inv = await admin.post("/api/staff/team", { name: "New Hire", email: "new.hire@vth.co.uk", role: "standard" });
t("invite creates a pending member + dev link", inv.member?.invited === true && !!inv.devInviteUrl, JSON.stringify(inv).slice(0, 160));
const token = new URL(inv.devInviteUrl).searchParams.get("token");
t("weak password rejected on accept", (await J(await post("/api/auth/invite", { token, password: "short" }))).s === 400);
t("accept invite with a good password signs in", (await J(await post("/api/auth/invite", { token, password: "GoodPassw0rd!" }))).user?.email === "new.hire@vth.co.uk");
const rst = await admin.post(`/api/staff/team/${inv.member.id}/reset`, {});
t("admin can send a password-reset link", !!rst.devInviteUrl, JSON.stringify(rst));
const rtoken = new URL(rst.devInviteUrl).searchParams.get("token");
t("reset link sets a new password and signs in", (await J(await post("/api/auth/invite", { token: rtoken, password: "BrandNewPass123" }))).user?.email === "new.hire@vth.co.uk");
t("the NEW password works and the OLD one no longer does", (await login("new.hire@vth.co.uk", "BrandNewPass123")).r.user?.email === "new.hire@vth.co.uk" && (await login("new.hire@vth.co.uk", "GoodPassw0rd!")).r.s === 401);
t("standard staff cannot trigger a reset (403)", (await std.post(`/api/staff/team/${inv.member.id}/reset`, {})).s === 403);
t("invite link is single-use", (await J(await post("/api/auth/invite", { token, password: "GoodPassw0rd!" }))).s === 404);

console.log("\n=== BRUTE-FORCE PROTECTION (runs last) ===");
const codesTried = [];
for (let i = 0; i < 6; i++) codesTried.push(await J(await post("/api/redeem/check", { code: `VTH-AAAA-BBBB-CC${i}${i}` })));
t("5 wrong guesses -> locked (429 with retryAfter)", codesTried.some((x) => x.s === 429 && x.retryAfter > 0), codesTried.map((x) => x.s).join(","));
r = await J(await post("/api/redeem/check", { code: "VTH-DEMO-VALD-2026" }));
t("while locked, even a valid code is refused", r.s === 429);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
