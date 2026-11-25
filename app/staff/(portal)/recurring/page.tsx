"use client";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Check, Lock, Mail, Pause, Play, Plus, Repeat, Send, Sparkles, Ticket, Users, X, XCircle, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { errMsg, useStore } from "@/lib/store";
import { effectiveStatus, fmtDate, fmtRelative, FREQ_LABEL, FREQUENCIES, type Frequency, type PlanStatus } from "@/lib/shared";

const CHIP: Record<PlanStatus, string> = { active: "active", paused: "pending", completed: "used", cancelled: "cancelled" };
const FREQ_SHORT: Record<Frequency, string> = { daily: "Daily", weekly: "Weekly", fortnightly: "2 weeks", monthly: "Monthly", yearly: "Yearly" };
const FREQ_ADV: Record<Frequency, string> = { daily: "every day", weekly: "every week", fortnightly: "every 2 weeks", monthly: "every month", yearly: "every year" };
const STEP_DAYS: Record<Frequency, number> = { daily: 1, weekly: 7, fortnightly: 14, monthly: 30, yearly: 365 };

function addPeriod(from: Date, f: Frequency) {
  const d = new Date(from);
  if (f === "daily") d.setDate(d.getDate() + 1);
  else if (f === "weekly") d.setDate(d.getDate() + 7);
  else if (f === "fortnightly") d.setDate(d.getDate() + 14);
  else if (f === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

/** "Name, email, organisation" per line (also accepts tab-separated rows pasted from a spreadsheet / CRM export). */
function parsePeople(text: string) {
  const ok: { name: string; email: string; org: string }[] = []; const bad: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    const parts = line.split(/\t|,|;/).map((s) => s.trim());
    const email = parts.find((p) => /^\S+@\S+\.\S+$/.test(p));
    const rest = parts.filter((p) => p && p !== email);
    if (!email || !rest[0]) { bad.push(line); continue; }
    ok.push({ name: rest[0], email, org: rest[1] ?? "" });
  }
  return { ok, bad };
}

export default function Recurring() {
  const { plans, codes, user, createPlan, planAction, bulkPlans, runRenewals } = useStore();
  const toast = useToast();
  const admin = user?.role === "admin";
  const [modal, setModal] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | PlanStatus>("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"one" | "many">("one");
  const [list, setList] = useState("");

  const [f, setF] = useState({ name: "", org: "", email: "", frequency: "monthly" as Frequency, spins: 1, expireAtNext: true, validity: 30, startMode: "now" as "now" | "date", startDate: "", endMode: "ongoing" as "ongoing" | "count" | "date", cycles: 6, endDate: "" });

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => { setBusy(key); try { await fn(); if (ok) toast(ok); } catch (e) { toast(errMsg(e), "error"); } setBusy(null); };

  const stats = useMemo(() => {
    const active = plans.filter((p) => p.status === "active");
    const issued = codes.filter((c) => c.planId).length;
    const next = active.map((p) => new Date(p.nextRunAt).getTime()).sort((a, b) => a - b)[0];
    return { active: active.length, paused: plans.filter((p) => p.status === "paused").length, issued, next };
  }, [plans, codes]);
  const shown = plans.filter((p) => tab === "all" || p.status === tab);
  const selected = plans.find((p) => p.id === sel) ?? null;
  const selCodes = selected ? codes.filter((c) => c.planId === selected.id).sort((a, b) => (b.cycleNo ?? 0) - (a.cycleNo ?? 0)) : [];
  const shownIds = shown.map((p) => p.id);
  const allPicked = shownIds.length > 0 && shownIds.every((id) => picked.has(id));
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const pickedPlans = plans.filter((p) => picked.has(p.id));

  const parsed = useMemo(() => parsePeople(list), [list]);
  const people = mode === "one" ? (f.name.trim() && /^\S+@\S+\.\S+$/.test(f.email) ? [{ name: f.name.trim(), org: f.org.trim(), email: f.email.trim() }] : []) : parsed.ok;

  const preview = useMemo(() => {
    const start = f.startMode === "date" && f.startDate ? new Date(f.startDate + "T07:00:00") : new Date();
    let endsOn: Date | null = null; let cycles: number | null = null;
    if (f.endMode === "count") { cycles = f.cycles; endsOn = start; for (let i = 1; i < f.cycles; i++) endsOn = addPeriod(endsOn, f.frequency); }
    if (f.endMode === "date" && f.endDate) { endsOn = new Date(f.endDate + "T23:59:59"); let n = 0; let d = start; while (d <= endsOn && n < 400) { n++; d = addPeriod(d, f.frequency); } cycles = n; }
    return { start, endsOn, total: cycles != null ? cycles * f.spins * Math.max(people.length, 1) : null };
  }, [f, people.length]);
  const emailOk = /^\S+@\S+\.\S+$/.test(f.email);
  const valid = people.length > 0 && (mode === "one" ? f.name.trim() && emailOk : parsed.bad.length === 0) && (f.endMode !== "date" || f.endDate) && (f.startMode !== "date" || f.startDate);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy("create");
    try {
      const r = await createPlan({
        people, frequency: f.frequency, spinsPerCycle: f.spins, expireAtNext: f.expireAtNext, codeValidityDays: f.validity,
        ...(f.startMode === "date" && f.startDate ? { startsAt: new Date(f.startDate + "T07:00:00").toISOString() } : {}),
        maxCycles: f.endMode === "count" ? f.cycles : null, endsAt: f.endMode === "date" && f.endDate ? new Date(f.endDate + "T23:59:59").toISOString() : null,
      });
      toast(r.issued ? `${r.plans.length} plan${r.plans.length > 1 ? "s" : ""} created, ${r.issued} fresh code${r.issued > 1 ? "s" : ""} emailed` : `${r.plans.length} plan${r.plans.length > 1 ? "s" : ""} created. The first code is sent on the start date`);
      setModal(false); setF({ ...f, name: "", org: "", email: "" }); setList("");
    } catch (err) { toast(errMsg(err), "error"); }
    setBusy(null);
  };

  const bulk = (action: "pause" | "resume" | "cancel") => {
    if (action === "cancel" && !confirm(`Cancel ${picked.size} recurring plan${picked.size > 1 ? "s" : ""}? No more codes will be issued. Existing codes stay valid.`)) return;
    run("bulk", async () => { const r = await bulkPlans([...picked], action); setPicked(new Set()); toast(`${r.done} plan${r.done === 1 ? "" : "s"} ${action === "pause" ? "paused" : action === "resume" ? "resumed" : "cancelled"}${r.skipped ? `, ${r.skipped} skipped (wrong state)` : ""}`); }, "");
  };

  const TABS = [["all", "All"], ["active", "Active"], ["paused", "Paused"], ["completed", "Completed"], ["cancelled", "Cancelled"]] as const;
  const count = (k: string) => (k === "all" ? plans.length : plans.filter((p) => p.status === k).length);

  return (
    <>
      <div className="pagehead">
        <div><h1>Recurring spins</h1><p>Allocate spins automatically on a schedule. Each period the system creates a brand-new unique code and emails it. Nothing to remember.</p></div>
        {admin && (
          <div className="page-actions">
            <button className="btn btn-ghost" disabled={busy === "run"} onClick={() => run("run", async () => { const s = await runRenewals(); toast(s.plansRun ? `Renewals run: ${s.codesIssued} codes issued` : "Nothing due right now"); }, "")}>{busy === "run" ? <span className="spinner" /> : <><Zap size={15} /> Run renewals now</>}</button>
            <button className="btn btn-gold" onClick={() => setModal(true)}><Plus size={17} /> New recurring plan</button>
          </div>
        )}
      </div>
      {!admin && <div className="banner"><Lock size={18} /> Only admins can create or change recurring plans, because they affect prize cost. You can view them here.</div>}

      <div className="kpis" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {[
          { l: "Active plans", v: stats.active, i: Repeat, s: `${stats.paused} paused` },
          { l: "Codes auto-issued", v: stats.issued, i: Ticket, s: "All time" },
          { l: "Next allocation", v: stats.next ? fmtRelative(new Date(stats.next).toISOString()).replace("in ", "") : "-", i: CalendarClock, s: stats.next ? fmtDate(new Date(stats.next).toISOString()) : "No active plans" },
          { l: "Runs automatically", v: "Daily", i: Sparkles, s: "07:00 UTC, emails sent for you" },
        ].map((k, i) => (
          <motion.div key={k.l} className="glass kpi" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <div className="ico"><k.i size={17} /></div><div className="lbl">{k.l}</div><div className="val" style={{ fontSize: typeof k.v === "string" ? 26 : 34 }}>{k.v}</div><div className="kfoot"><span className="sub">{k.s}</span></div>
          </motion.div>
        ))}
      </div>

      <div className="seg" role="tablist" style={{ margin: "18px 0 14px", maxWidth: "100%", overflowX: "auto" }}>
        {TABS.map(([k, l]) => (<button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); setPicked(new Set()); }}>{tab === k && <motion.span layoutId="plantab" className="seg-pill" />}<span>{l}</span><span className="n">{count(k)}</span></button>))}
      </div>

      <AnimatePresence>
        {admin && picked.size > 0 && (
          <motion.div className="bulkbar" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <b>{picked.size} selected</b>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-ghost btn-sm" disabled={busy === "bulk" || !pickedPlans.some((p) => p.status === "active")} onClick={() => bulk("pause")}><Pause size={14} /> Pause</button>
              <button className="btn btn-ghost btn-sm" disabled={busy === "bulk" || !pickedPlans.some((p) => p.status === "paused")} onClick={() => bulk("resume")}><Play size={14} /> Resume</button>
              <button className="btn btn-danger btn-sm" disabled={busy === "bulk" || !pickedPlans.some((p) => p.status === "active" || p.status === "paused")} onClick={() => bulk("cancel")}><XCircle size={14} /> Cancel plans</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setPicked(new Set())}>Clear</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass tablewrap">
        <table>
          <thead><tr>
            {admin && <th style={{ width: 40 }}><input type="checkbox" className="cb" aria-label="Select all" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(shownIds))} /></th>}
            <th>Recipient</th><th>Schedule</th><th>Progress</th><th>Next allocation</th><th>Status</th><th />
          </tr></thead>
          <tbody>
            {shown.map((p) => {
              const pct = p.maxCycles ? Math.min(100, (p.cyclesDone / p.maxCycles) * 100) : null;
              return (
                <motion.tr key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} onClick={() => setSel(p.id)}>
                  {admin && <td onClick={(e) => e.stopPropagation()}><input type="checkbox" className="cb" aria-label={`Select ${p.name}`} checked={picked.has(p.id)} onChange={() => toggle(p.id)} /></td>}
                  <td><b>{p.name}</b><div className="sub">{p.org || "-"} · {p.email}</div></td>
                  <td><div>{FREQ_LABEL[p.frequency]}</div><div className="sub">{p.spinsPerCycle} spin{p.spinsPerCycle > 1 ? "s" : ""} on a fresh code</div></td>
                  <td style={{ minWidth: 150 }}>
                    <div style={{ fontSize: 13 }}><b>{p.cyclesDone}</b>{p.maxCycles ? ` of ${p.maxCycles} allocations` : ` allocation${p.cyclesDone === 1 ? "" : "s"} · ongoing`}</div>
                    {pct != null && <div className="usebar" style={{ marginTop: 6 }}><motion.i initial={{ width: 0 }} animate={{ width: `${pct}%` }} /></div>}
                  </td>
                  <td>{p.status === "active" ? <><div>{fmtDate(p.nextRunAt)}</div><div className="sub">{fmtRelative(p.nextRunAt)}</div></> : <span style={{ color: "var(--dim)" }}>-</span>}</td>
                  <td><span className={`chip ${CHIP[p.status]}`}>{p.status[0].toUpperCase() + p.status.slice(1)}</span></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {admin && (
                      <div className="row-actions">
                        {p.status === "active" && <button className="icon-btn" title="Issue next allocation now" aria-label="Issue now" disabled={busy === p.id} onClick={() => run(p.id, () => planAction(p.id, "issue-now"), "Next allocation issued and emailed")}><Send size={15} /></button>}
                        {p.status === "active" && <button className="icon-btn" title="Pause" aria-label="Pause" disabled={busy === p.id} onClick={() => run(p.id, () => planAction(p.id, "pause"), "Plan paused")}><Pause size={15} /></button>}
                        {p.status === "paused" && <button className="icon-btn" title="Resume" aria-label="Resume" disabled={busy === p.id} onClick={() => run(p.id, () => planAction(p.id, "resume"), "Plan resumed")}><Play size={15} /></button>}
                        {(p.status === "active" || p.status === "paused") && <button className="icon-btn" title="Cancel plan" aria-label="Cancel plan" style={{ color: "var(--red)" }} disabled={busy === p.id} onClick={() => { if (confirm(`Cancel the recurring plan for ${p.name}? No more codes will be issued. Existing codes stay valid.`)) run(p.id, () => planAction(p.id, "cancel"), "Plan cancelled"); }}><XCircle size={15} /></button>}
                      </div>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
        {shown.length === 0 && (
          <div className="empty"><Repeat size={30} style={{ opacity: 0.4 }} /><p style={{ marginTop: 10, fontWeight: 500, color: "var(--text)" }}>No recurring plans {tab !== "all" ? `that are ${tab}` : "yet"}</p>
            <p style={{ fontSize: 13.5 }}>Create one to automatically send a fresh spin code every day, week, month or year.</p>
            {admin && <button className="btn btn-gold btn-sm" style={{ marginTop: 14 }} onClick={() => setModal(true)}><Plus size={15} /> New recurring plan</button>}</div>
        )}
      </div>

      <div className="glass card" style={{ marginTop: 18 }}>
        <h3>How auto-allocation works</h3>
        <div className="how">
          {[[CalendarClock, "On schedule", "Every day the system checks which plans are due, on the date you set."], [Ticket, "One fresh code", "A brand-new unique code is created with 1 or 2 spins. A second spin replaces the first prize, and the client accepts their prize."], [Mail, "Emailed for you", "The client gets a “your new spin is ready” email with a link that pre-fills the code."], [Check, "Expires on time", "An unused code expires when the next allocation is due. Each code is single-use and audited."]].map(([I, t, d], i) => {
            const Icon = I as typeof Mail;
            return <div key={i}><span className="rico" style={{ margin: 0, width: 38, height: 38 }}><Icon size={17} /></span><b>{t as string}</b><small>{d as string}</small></div>;
          })}
        </div>
      </div>

      <AnimatePresence>
        {modal && (
          <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModal(false)}>
            <motion.form className="modal wide" onSubmit={submit} onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ type: "spring", stiffness: 300, damping: 28 }}>
              <button type="button" className="icon-btn" style={{ position: "absolute", right: 18, top: 18 }} onClick={() => setModal(false)} aria-label="Close"><X size={16} /></button>
              <span className="eyebrow"><Repeat size={13} /> Auto-allocation</span>
              <h2 style={{ fontSize: 24, margin: "14px 0 4px" }}>New recurring plan</h2>
              <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16 }}>A fresh unique code is created and emailed automatically each period.</p>

              <div className="seg" style={{ width: "fit-content", marginBottom: 16 }}>
                {([["one", "One person", Repeat], ["many", "Many people", Users]] as const).map(([m, l, I]) => (<button type="button" key={m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>{mode === m && <motion.span layoutId="pmode" className="seg-pill" />}<span><I size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{l}</span></button>))}
              </div>

              {mode === "one" ? (
                <div className="formgrid">
                  <div className="field"><label htmlFor="rn">Recipient name *</label><input id="rn" className="input" required autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Sarah Mitchell" /></div>
                  <div className="field"><label htmlFor="ro">Organisation</label><input id="ro" className="input" value={f.org} onChange={(e) => setF({ ...f, org: e.target.value })} placeholder="e.g. Brightwave Ltd" /></div>
                  <div className="field full"><label htmlFor="re">Email address * <span style={{ fontWeight: 400, color: "var(--dim)" }}>(codes are sent here automatically)</span></label><input id="re" type="email" className="input" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@company.co.uk" style={f.email && !emailOk ? { borderColor: "var(--red)" } : undefined} /></div>
                </div>
              ) : (
                <div className="field">
                  <label htmlFor="rl">Paste one person per line: <i style={{ fontWeight: 400 }}>Name, email, organisation</i></label>
                  <textarea id="rl" className="input" rows={6} value={list} onChange={(e) => setList(e.target.value)} placeholder={"Sarah Mitchell, sarah@brightwave.co.uk, Brightwave Ltd\nJames Okoye, james@northfield.org, Northfield Care"} style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 13 }} />
                  <small style={{ color: parsed.bad.length ? "var(--red)" : "var(--dim)", fontSize: 12.5 }}>{parsed.ok.length} valid {parsed.ok.length === 1 ? "person" : "people"}{parsed.bad.length ? ` · ${parsed.bad.length} line${parsed.bad.length > 1 ? "s" : ""} need a name and a valid email: “${parsed.bad[0].slice(0, 40)}”` : ". Works with rows copied from a spreadsheet or CRM export."}</small>
                </div>
              )}

              <div className="formgrid" style={{ marginTop: 14 }}>
                <div className="field full"><label>How often</label>
                  <div className="seg" style={{ width: "fit-content", maxWidth: "100%", overflowX: "auto" }}>{FREQUENCIES.map((x) => (<button type="button" key={x} className={f.frequency === x ? "on" : ""} onClick={() => setF({ ...f, frequency: x, validity: Math.min(400, Math.max(STEP_DAYS[x], 7)) })}>{f.frequency === x && <motion.span layoutId="freq" className="seg-pill" />}<span>{FREQ_SHORT[x]}</span></button>))}</div></div>
                <div className="field"><label>Spins on each code</label>
                  <div className="seg">{[1, 2].map((n) => (<button type="button" key={n} className={f.spins === n ? "on" : ""} onClick={() => setF({ ...f, spins: n })}>{f.spins === n && <motion.span layoutId="spins" className="seg-pill" />}<span>{n} spin{n > 1 ? "s" : ""}</span></button>))}</div>
                  {f.spins === 2 && <small style={{ color: "var(--dim)", fontSize: 12.5 }}>A second spin replaces the first prize. The client then accepts their prize.</small>}</div>
                <div className="field"><label>Unused code expires</label>
                  <div className="seg">{([[true, "At next allocation"], [false, "After set days"]] as const).map(([v, l]) => (<button type="button" key={l} className={f.expireAtNext === v ? "on" : ""} onClick={() => setF({ ...f, expireAtNext: v })}>{f.expireAtNext === v && <motion.span layoutId="exp" className="seg-pill" />}<span>{l}</span></button>))}</div>
                  {!f.expireAtNext && <select className="input" style={{ marginTop: 8 }} value={f.validity} onChange={(e) => setF({ ...f, validity: +e.target.value })} aria-label="Validity in days">{[1, 7, 14, 30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>{d} day{d > 1 ? "s" : ""}</option>)}</select>}</div>

                <div className="field"><label>First code sent</label>
                  <div className="seg">{(["now", "date"] as const).map((m) => (<button type="button" key={m} className={f.startMode === m ? "on" : ""} onClick={() => setF({ ...f, startMode: m })}>{f.startMode === m && <motion.span layoutId="start" className="seg-pill" />}<span>{m === "now" ? "Immediately" : "On a date"}</span></button>))}</div>
                  {f.startMode === "date" && <input type="date" className="input" style={{ marginTop: 8 }} min={new Date().toISOString().slice(0, 10)} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} aria-label="Start date" />}</div>
                <div className="field"><label>Runs</label>
                  <div className="seg" style={{ maxWidth: "100%", overflowX: "auto" }}>{([["ongoing", "Ongoing"], ["count", "N times"], ["date", "Until date"]] as const).map(([m, l]) => (<button type="button" key={m} className={f.endMode === m ? "on" : ""} onClick={() => setF({ ...f, endMode: m })}>{f.endMode === m && <motion.span layoutId="end" className="seg-pill" />}<span>{l}</span></button>))}</div>
                  {f.endMode === "count" && <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}><input type="number" min={1} max={400} className="input" style={{ width: 100 }} value={f.cycles} onChange={(e) => setF({ ...f, cycles: Math.max(1, Math.min(400, +e.target.value || 1)) })} aria-label="Number of allocations" /><span style={{ color: "var(--muted)", fontSize: 14 }}>allocations</span></div>}
                  {f.endMode === "date" && <input type="date" className="input" style={{ marginTop: 8 }} min={new Date().toISOString().slice(0, 10)} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} aria-label="End date" />}</div>
              </div>

              <div className="summary">
                <Sparkles size={16} />
                <div>
                  <b>{mode === "many" ? `${people.length} ${people.length === 1 ? "person" : "people"}` : f.name.trim() || "The recipient"}</b> will each receive <b>a fresh code with {f.spins} spin{f.spins > 1 ? "s" : ""}</b> {FREQ_ADV[f.frequency]}
                  {f.startMode === "now" ? ", starting today" : f.startDate ? `, starting ${fmtDate(preview.start.toISOString())}` : ""}
                  {f.endMode === "ongoing" ? ", until you cancel." : preview.endsOn ? `, finishing around ${fmtDate(preview.endsOn.toISOString())}.` : "."}
                  {" "}{f.expireAtNext ? "An unused code expires when the next one is due." : `Each code lasts ${f.validity} day${f.validity > 1 ? "s" : ""}.`}
                  {preview.total != null && <span className="exposure"> Maximum prize exposure: <b>{preview.total} spin{preview.total === 1 ? "" : "s"}</b>.</span>}
                  {f.endMode === "ongoing" && <span className="exposure"> No end date means no cap on total spins.</span>}
                </div>
              </div>
              <button className="btn btn-gold btn-lg" style={{ width: "100%", marginTop: 18 }} disabled={!valid || busy === "create"}>{busy === "create" ? <span className="spinner" /> : <><Repeat size={18} /> Create {people.length > 1 ? `${people.length} plans` : "plan"}{f.startMode === "now" ? " & send first codes" : ""}</>}</button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && (
          <>
            <motion.div className="drawer-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSel(null)} />
            <motion.aside className="drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 34 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div><span className={`chip ${CHIP[selected.status]}`}>{selected.status}</span><h2 style={{ fontSize: 24, marginTop: 12 }}>{selected.name}</h2><p style={{ color: "var(--muted)" }}>{selected.org} · {selected.email}</p></div>
                <button className="icon-btn" onClick={() => setSel(null)} aria-label="Close"><X size={16} /></button>
              </div>
              <dl className="kv" style={{ marginTop: 22 }}>
                <dt>Schedule</dt><dd>{FREQ_LABEL[selected.frequency]} · {selected.spinsPerCycle} spin{selected.spinsPerCycle > 1 ? "s" : ""} per code</dd>
                <dt>Unused code</dt><dd>{selected.expireAtNext ? "Expires at the next allocation" : `Valid for ${selected.codeValidityDays} days`}</dd>
                <dt>Started</dt><dd>{fmtDate(selected.startsAt)}</dd>
                <dt>Next allocation</dt><dd>{selected.status === "active" ? `${fmtDate(selected.nextRunAt)} (${fmtRelative(selected.nextRunAt)})` : "-"}</dd>
                <dt>Ends</dt><dd>{selected.maxCycles ? `After ${selected.maxCycles} allocations` : selected.endsAt ? fmtDate(selected.endsAt) : "Until cancelled"}</dd>
                <dt>Created by</dt><dd>{selected.createdBy}</dd>
              </dl>
              <h3 style={{ fontSize: 15, margin: "26px 0 8px" }}>Codes issued ({selCodes.length})</h3>
              {selCodes.length === 0 && <p style={{ color: "var(--dim)", fontSize: 14 }}>No codes issued yet.</p>}
              <div style={{ display: "grid", gap: 8 }}>
                {selCodes.map((c) => { const s = effectiveStatus(c); return (
                  <div key={c.id} className="plan-code"><div><span className="mono">{c.code}</span><small>Allocation #{c.cycleNo} · {fmtDate(c.createdAt)}{c.emailedAt ? " · emailed" : " · not emailed"}</small></div><span className={`chip ${s}`}>{s === "awaiting" ? "awaiting accept" : s}</span></div>
                ); })}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
