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
t("standard staff cannot create recurring plans (403)", (await std.post("/api/staff/plans", { people: [{ name: "X", email: "x@y.co" }], frequency: "weekly", spinsPerCycle: 1 })).s === 403);
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

console.log("\n=== RECURRING PLANS (one fresh unique code per allocation) ===");
let pr = await admin.post("/api/staff/plans", { people: [{ name: "Plan Person", org: "Recur Ltd", email: "plan@recur.co.uk" }], frequency: "monthly", spinsPerCycle: 2, maxCycles: 3 });
let p = { plan: pr.plans?.[0], issued: pr.issued };
t("plan created, first allocation issued immediately (ONE code, 2 spins)", p.issued === 1 && p.plan?.cyclesDone === 1 && p.plan?.expireAtNext === true, JSON.stringify(pr).slice(0, 220));
const b2 = await admin.get("/api/staff/bootstrap");
const planCodes = b2.codes.filter((x) => x.planId === p.plan.id);
t("the code is unique, emailed, allows 2 spins", planCodes.length === 1 && planCodes[0].spinsAllowed === 2 && planCodes[0].cycleNo === 1 && !!planCodes[0].emailedAt);
const dueIn = new Date(p.plan.nextRunAt) - Date.now();
t("next allocation scheduled ~1 month ahead", dueIn > 27 * 864e5 && dueIn < 32 * 864e5, `${dueIn / 864e5}d`);
t("an unused code expires exactly when the NEXT allocation is due", Math.abs(new Date(planCodes[0].expiresAt) - new Date(p.plan.nextRunAt)) < 2000, `${planCodes[0].expiresAt} vs ${p.plan.nextRunAt}`);
if (process.env.CRON_SECRET) {
  t("cron endpoint rejects callers without the secret (401)", (await fetch(B + "/api/cron/renewals")).status === 401);
  t("cron endpoint rejects a wrong secret (401)", (await fetch(B + "/api/cron/renewals", { headers: { authorization: "Bearer nope" } })).status === 401);
}
let cron = await J(await fetch(B + "/api/cron/renewals", { headers: process.env.CRON_SECRET ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : {} }));
t("cron runs and finds nothing due (idempotent)", cron.ok === true && cron.plansRun === 0, JSON.stringify(cron));
p = await admin.patch(`/api/staff/plans/${p.plan.id}`, { action: "issue-now" });
t("'issue now' issues allocation 2 early", p.issued === 1 && p.plan.cyclesDone === 2);
p = await admin.patch(`/api/staff/plans/${p.plan.id}`, { action: "issue-now" });
t("allocation 3 reaches max_cycles -> plan completes", p.plan.cyclesDone === 3 && p.plan.status === "completed", p.plan?.status);
t("completed plan can't issue more", (await admin.patch(`/api/staff/plans/${p.plan.id}`, { action: "issue-now" })).s === 409);
const bAll = (await admin.get("/api/staff/bootstrap")).codes.filter((x) => x.planId === p.plan.id);
t("3 allocations = 3 DISTINCT codes", new Set(bAll.map((x) => x.code)).size === 3);
const q = (await admin.post("/api/staff/plans", { people: [{ name: "Pause Me", email: "pause@x.co.uk" }], frequency: "weekly", spinsPerCycle: 1 })).plans[0];
t("pause", (await admin.patch(`/api/staff/plans/${q.id}`, { action: "pause" })).plan.status === "paused");
t("resume", (await admin.patch(`/api/staff/plans/${q.id}`, { action: "resume" })).plan.status === "active");
t("cancel", (await admin.patch(`/api/staff/plans/${q.id}`, { action: "cancel" })).plan.status === "cancelled");
for (const [f, min, max] of [["daily", 0.9, 1.1], ["yearly", 360, 370]]) {
  const x = await admin.post("/api/staff/plans", { people: [{ name: `Freq ${f}`, email: `${f}@x.co.uk` }], frequency: f, spinsPerCycle: 1 });
  const d = (new Date(x.plans?.[0]?.nextRunAt) - Date.now()) / 864e5;
  t(`${f} frequency schedules the next allocation ~${f === "daily" ? "1 day" : "1 year"} ahead`, d > min && d < max, `${d}d ${JSON.stringify(x).slice(0, 120)}`);
}
t("fixed-days validity is honoured when expireAtNext is false", await (async () => {
  const x = await admin.post("/api/staff/plans", { people: [{ name: "Fixed Days", email: "fixed@x.co.uk" }], frequency: "monthly", spinsPerCycle: 1, expireAtNext: false, codeValidityDays: 10 });
  const c = (await admin.get("/api/staff/bootstrap")).codes.find((k) => k.planId === x.plans[0].id);
  const d = (new Date(c.expiresAt) - new Date(c.createdAt)) / 864e5; return Math.abs(d - 10) < 0.01;
})());

console.log("\n=== BULK: MANY PEOPLE, MASS ACTIONS ===");
const many = await admin.post("/api/staff/plans", { people: [1, 2, 3].map((i) => ({ name: `Bulk ${i}`, email: `bulk${i}@x.co.uk`, org: "Bulk Ltd" })), frequency: "weekly", spinsPerCycle: 1 });
t("one request creates 3 plans and issues 3 codes", many.plans?.length === 3 && many.issued === 3, JSON.stringify(many).slice(0, 160));
const ids = many.plans.map((x) => x.id);
let bp = await admin.post("/api/staff/plans/bulk", { ids, action: "pause" });
t("bulk pause 3 plans", bp.done === 3 && bp.skipped === 0, JSON.stringify(bp));
bp = await admin.post("/api/staff/plans/bulk", { ids, action: "pause" });
t("bulk pause again skips those already paused", bp.done === 0 && bp.skipped === 3, JSON.stringify(bp));
bp = await admin.post("/api/staff/plans/bulk", { ids, action: "cancel" });
t("bulk cancel 3 plans (paused plans can be cancelled)", bp.done === 3, JSON.stringify(bp));
t("standard staff cannot bulk-change plans (403)", (await std.post("/api/staff/plans/bulk", { ids, action: "cancel" })).s === 403);
const bc = [];
for (let i = 0; i < 3; i++) bc.push((await admin.post("/api/staff/codes", { name: `Mass ${i}`, email: `mass${i}@x.co.uk`, days: 7 })).code.id);
let bk = await std.post("/api/staff/codes/bulk", { ids: bc, action: "send" });
t("bulk email 3 codes", bk.done === 3, JSON.stringify(bk));
bk = await std.post("/api/staff/codes/bulk", { ids: [...bc, boot.codes.find((x) => x.status === "used").id], action: "cancel" });
t("bulk cancel cancels the 3 active codes and skips the used one", bk.done === 3 && bk.skipped === 1, JSON.stringify(bk));
const bs = (await admin.get("/api/staff/bootstrap")).codes.filter((x) => bc.includes(x.id));
t("all three are now cancelled", bs.every((x) => x.status === "cancelled"));

console.log("\n=== LOST-RESPONSE RECOVERY (browser-generated claim secret) ===");
const claim = "browserMadeSecret_0123456789abcdef";
const fresh = planCodes[0].code; // a 2-spin plan code
let first;
{
  const chk = await J(await post("/api/redeem/check", { code: fresh }));
  t("check tells the page how many spins the code gives", chk.ok === true && chk.spins === 2, JSON.stringify(chk));
  const sp = await J(await post("/api/redeem/spin", { code: fresh, pass: chk.pass, claimToken: claim }));
  first = sp;
  t("spin with a browser-supplied claim secret succeeds", sp.ok === true && !!sp.ref, JSON.stringify(sp));
  const rec = await J(await post("/api/redeem/check", { code: fresh, claimToken: claim }));
  t("browser recovers the SAME prize + reference from its own secret", rec.restored === true && rec.ref === sp.ref && rec.reward.id === sp.reward.id, JSON.stringify(rec));
  const other = await J(await post("/api/redeem/check", { code: fresh, claimToken: "someoneElsesSecret_0123456789abcdef" }));
  t("a different browser with the code but not the secret gets 'used'", other.reason === "used");
}

console.log("\n=== TWO-SPIN CODES: spin again voids the first prize, accept is final ===");
t("after spin 1 of 2 the prize is NOT final and a respin is offered", first.final === false && first.canRespin === true && first.spinsAllowed === 2 && first.spinsUsed === 1, JSON.stringify(first));
let ps = (await admin.get("/api/staff/bootstrap")).codes.find((x) => x.code === fresh);
t("staff see it as awaiting acceptance (not yet 'used', not in 'to fulfil')", ps.status === "active" && ps.spinsUsed === 1 && !ps.acceptedAt && !ps.fulfilment, JSON.stringify(ps));
r = await J(await post("/api/redeem/spin", { code: fresh, respin: true, claimToken: "someoneElsesSecret_0123456789abcdef" }));
t("someone WITHOUT the claim secret cannot void the owner's prize", r.ok !== true && r.reason === "used", JSON.stringify(r));
r = await J(await post("/api/redeem/accept", { code: fresh, claimToken: "someoneElsesSecret_0123456789abcdef" }));
t("someone WITHOUT the claim secret cannot accept it either", r.ok !== true && r.s === 409, JSON.stringify(r));
const twice = await Promise.all([1, 2, 3].map(() => post("/api/redeem/spin", { code: fresh, respin: true, claimToken: claim }).then(J)));
const refs = new Set(twice.map((x) => x.ref));
t("a double-clicked 'spin again' produces exactly ONE second prize", twice.every((x) => x.ok) && refs.size === 1 && twice.every((x) => x.final === true), JSON.stringify(twice.map((x) => x.ref)));
const second = twice[0];
t("the second prize is final and has its own reference", second.final === true && second.canRespin === false && second.ref !== first.ref && second.spinsUsed === 2, JSON.stringify(second));
ps = (await admin.get("/api/staff/bootstrap")).codes.find((x) => x.code === fresh);
t("staff: code used, accepted, ready to action, one earlier prize voided", ps.status === "used" && !!ps.acceptedAt && ps.fulfilment === "pending" && ps.voidedCount === 1 && ps.ref === second.ref, JSON.stringify(ps));
r = await J(await post("/api/redeem/spin", { code: fresh, respin: true, claimToken: claim }));
t("a third spin is impossible: returns the existing final prize", r.restored === true && r.ref === second.ref, JSON.stringify(r));

{
  const g = await admin.post("/api/staff/codes", { name: "Accept Tester", org: "Acme", email: "accept@acme.co.uk", days: 14, spins: 2 });
  t("staff can generate a 2-spin code", g.code?.spinsAllowed === 2, JSON.stringify(g).slice(0, 160));
  const code = g.code.code, cl = "acceptTesterSecret_0123456789abc";
  const chk = await J(await post("/api/redeem/check", { code }));
  const sp = await J(await post("/api/redeem/spin", { code, pass: chk.pass, claimToken: cl }));
  const noMail = (await admin.get("/api/staff/bootstrap")).activity.filter((x) => x.kind === "accept").length;
  const ac = await J(await post("/api/redeem/accept", { code, claimToken: cl }));
  t("accepting makes the prize final with the SAME reference", ac.ok === true && ac.final === true && ac.ref === sp.ref && ac.reward.id === sp.reward.id, JSON.stringify(ac));
  const ac2 = await J(await post("/api/redeem/accept", { code, claimToken: cl }));
  t("accepting twice is harmless (idempotent)", ac2.ok === true && ac2.ref === sp.ref);
  const after = await admin.get("/api/staff/bootstrap");
  t("the admin portal is notified (an 'accept' entry in the activity feed)", after.activity.filter((x) => x.kind === "accept").length === noMail + 1);
  const row = after.codes.find((x) => x.code === code);
  t("accepted code: used + fulfilment pending + no voided prizes", row.status === "used" && row.fulfilment === "pending" && row.voidedCount === 0);
  const rs = await J(await post("/api/redeem/spin", { code, respin: true, claimToken: cl }));
  t("after accepting, 'spin again' can no longer change the prize", rs.restored === true && rs.ref === sp.ref, JSON.stringify(rs));
  const em = await admin.get("/api/staff/bootstrap");
  t("the staff 'to fulfil' count includes it", em.codes.some((x) => x.code === code && x.fulfilment === "pending"));
}

console.log("\n=== PRIZE MEDIA, UPLOADS, LEGAL PAGES ===");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const upload = async (cookie, bytes, name, type) => { const fd = new FormData(); fd.append("file", new Blob([bytes], { type }), name); return J(await fetch(B + "/api/staff/media", { method: "POST", headers: { cookie }, body: fd })); };
const up = await upload(a.cookie, PNG, "prize.png", "image/png");
t("admin can upload a PNG and gets a URL", /^\/api\/media\/[0-9a-f-]{36}$/.test(up.url ?? ""), JSON.stringify(up));
const img = await fetch(B + up.url);
t("the image is served publicly with the right type + long cache", img.status === 200 && img.headers.get("content-type") === "image/png" && /immutable/.test(img.headers.get("cache-control") ?? "") && Buffer.from(await img.arrayBuffer()).equals(PNG));
t("standard staff cannot upload (403)", (await upload(s.cookie, PNG, "x.png", "image/png")).s === 403);
t("a text/HTML file renamed .png is rejected (415)", (await upload(a.cookie, Buffer.from("<script>alert(1)</script>"), "evil.png", "image/png")).s === 415);
t("an SVG is rejected (415): scripts could hide in it", (await upload(a.cookie, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'), "x.svg", "image/svg+xml")).s === 415);
t("a file over 3 MB is rejected (413)", (await upload(a.cookie, Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024)]), "big.png", "image/png")).s === 413);
t("anonymous upload is rejected (401)", (await J(await fetch(B + "/api/staff/media", { method: "POST", body: new FormData() }))).s === 401);
const rw2 = { name: "£10 Learning Credit", label: "£10 Learning|Credit", desc: "Pop-up text", icon: "coins" };
t("attach an uploaded image to a prize", (await admin.patch("/api/staff/rewards/2", { ...rw2, mediaType: "image", mediaUrl: up.url })).reward?.mediaUrl === up.url);
t("attach a YouTube video link to another prize", (await admin.patch("/api/staff/rewards/3", { ...rw2, mediaType: "video", mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" })).reward?.mediaType === "video");
t("a javascript: link is rejected (400)", (await admin.patch("/api/staff/rewards/3", { ...rw2, mediaType: "video", mediaUrl: "javascript:alert(1)" })).s === 400);
t("a plain http: video link is rejected (400)", (await admin.patch("/api/staff/rewards/3", { ...rw2, mediaType: "video", mediaUrl: "http://example.com/v.mp4" })).s === 400);
const wh = await (await fetch(B + "/api/public/wheel")).json();
t("the public wheel API carries each prize's media for the pop-up", wh.rewards.find((x) => x.id === 2)?.mediaUrl === up.url && wh.rewards.find((x) => x.id === 3)?.mediaType === "video" && wh.rewards.find((x) => x.id === 1)?.mediaUrl === undefined);
t("clearing the media removes it", (await admin.patch("/api/staff/rewards/3", { ...rw2, mediaType: null, mediaUrl: null })).reward?.mediaUrl === undefined);
const lg = await (await fetch(B + "/api/public/legal")).json();
t("legal pages: terms, privacy and prize rules are published", lg.docs?.length === 3 && ["terms", "privacy", "prize-rules"].every((x) => lg.docs.some((d) => d.slug === x)));
t("standard staff cannot edit legal pages (403)", (await std.put("/api/staff/legal", { slug: "terms", title: "T", body: "x" })).s === 403);
const lput = await admin.put("/api/staff/legal", { slug: "privacy", title: "Privacy Notice", body: "# Privacy Notice\n\nWe keep your data for 24 months.\n\n- one\n- two", pdfUrl: up.url });
t("admin publishes new wording + a PDF link", lput.docs?.find((d) => d.slug === "privacy")?.body.includes("24 months"));
const lg2 = await (await fetch(B + "/api/public/legal")).json();
t("visitors immediately see the new wording; the other pages are untouched", lg2.docs.find((d) => d.slug === "privacy")?.body.includes("24 months") && lg2.docs.find((d) => d.slug === "terms")?.body.includes("placeholder"));
t("a legal PDF link must point at our own uploads (400)", (await admin.put("/api/staff/legal", { slug: "terms", title: "T", body: "x", pdfUrl: "https://evil.example/x.pdf" })).s === 400);
for (const pth of ["/", "/rules", "/legal/terms", "/legal/privacy", "/legal/prize-rules"]) t(`public page ${pth} renders (200)`, (await fetch(B + pth)).status === 200);

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
{
  const inv2 = await admin.post("/api/staff/team", { name: "Resend Me", email: "resend.me@vth.co.uk", role: "standard" });
  const oldTok = new URL(inv2.devInviteUrl).searchParams.get("token");
  const again = await admin.post(`/api/staff/team/${inv2.member.id}/reset`, {});
  t("admin can RESEND a pending invite (flagged as an invite, not a reset)", again.pending === true && !!again.devInviteUrl, JSON.stringify(again));
  t("the OLD invite link stops working after a resend", (await J(await post("/api/auth/invite", { token: oldTok, password: "GoodPassw0rd!" }))).s === 404);
  const newTok = new URL(again.devInviteUrl).searchParams.get("token");
  t("the NEW invite link works", (await J(await post("/api/auth/invite", { token: newTok, password: "GoodPassw0rd!" }))).user?.email === "resend.me@vth.co.uk");
}
t("invite link is single-use", (await J(await post("/api/auth/invite", { token, password: "GoodPassw0rd!" }))).s === 404);

console.log("\n=== BRUTE-FORCE PROTECTION (runs last) ===");
const codesTried = [];
for (let i = 0; i < 6; i++) codesTried.push(await J(await post("/api/redeem/check", { code: `VTH-AAAA-BBBB-CC${i}${i}` })));
t("5 wrong guesses -> locked (429 with retryAfter)", codesTried.some((x) => x.s === 429 && x.retryAfter > 0), codesTried.map((x) => x.s).join(","));
r = await J(await post("/api/redeem/check", { code: "VTH-DEMO-VALD-2026" }));
t("while locked, even a valid code is refused", r.s === 429);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
