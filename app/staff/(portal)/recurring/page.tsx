"use client";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Check, Lock, Mail, Pause, Play, Plus, Repeat, Send, Sparkles, Ticket, X, XCircle, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { errMsg, useStore } from "@/lib/store";
import { effectiveStatus, fmtDate, fmtRelative, FREQ_LABEL, type Frequency, type Plan, type PlanStatus } from "@/lib/shared";

const CHIP: Record<PlanStatus, string> = { active: "active", paused: "pending", completed: "used", cancelled: "cancelled" };
const STEP_DAYS: Record<Frequency, number> = { weekly: 7, fortnightly: 14, monthly: 30 };

function addPeriod(from: Date, f: Frequency) {
  const d = new Date(from);
  if (f === "weekly") d.setDate(d.getDate() + 7); else if (f === "fortnightly") d.setDate(d.getDate() + 14); else d.setMonth(d.getMonth() + 1);
  return d;
}

export default function Recurring() {
  const { plans, codes, user, createPlan, planAction, runRenewals } = useStore();
  const toast = useToast();
  const admin = user?.role === "admin";
  const [modal, setModal] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | PlanStatus>("all");

  const [f, setF] = useState({ name: "", org: "", email: "", frequency: "monthly" as Frequency, spins: 1, validity: 30, startMode: "now" as "now" | "date", startDate: "", endMode: "count" as "ongoing" | "count" | "date", cycles: 6, endDate: "" });

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => { setBusy(key); try { await fn(); toast(ok); } catch (e) { toast(errMsg(e), "error"); } setBusy(null); };

  const stats = useMemo(() => {
    const active = plans.filter((p) => p.status === "active");
    const issued = codes.filter((c) => c.planId).length;
    const next = active.map((p) => new Date(p.nextRunAt).getTime()).sort((a, b) => a - b)[0];
    return { active: active.length, paused: plans.filter((p) => p.status === "paused").length, issued, next };
  }, [plans, codes]);
  const shown = plans.filter((p) => tab === "all" || p.status === tab);
  const selected = plans.find((p) => p.id === sel) ?? null;
  const selCodes = selected ? codes.filter((c) => c.planId === selected.id).sort((a, b) => (b.cycleNo ?? 0) - (a.cycleNo ?? 0)) : [];

  // plain-English summary + prize exposure so the admin sees the commitment before creating it
  const preview = useMemo(() => {
    const start = f.startMode === "date" && f.startDate ? new Date(f.startDate + "T07:00:00") : new Date();
    const total = f.endMode === "count" ? f.cycles * f.spins : null;
    let endsOn: Date | null = null;
    if (f.endMode === "count") { endsOn = start; for (let i = 1; i < f.cycles; i++) endsOn = addPeriod(endsOn, f.frequency); }
    if (f.endMode === "date" && f.endDate) endsOn = new Date(f.endDate + "T23:59:59");
    const cycles = f.endMode === "date" && f.endDate ? (() => { let n = 0; let d = start; while (d <= endsOn! && n < 60) { n++; d = addPeriod(d, f.frequency); } return n; })() : f.endMode === "count" ? f.cycles : null;
    return { start, endsOn, total: cycles != null ? cycles * f.spins : null };
  }, [f]);
  const emailOk = /^\S+@\S+\.\S+$/.test(f.email);
  const valid = f.name.trim() && emailOk && (f.endMode !== "date" || f.endDate) && (f.startMode !== "date" || f.startDate);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy("create");
    try {
      const r = await createPlan({
        name: f.name.trim(), org: f.org.trim(), email: f.email.trim(), frequency: f.frequency, spinsPerCycle: f.spins, codeValidityDays: f.validity,
        ...(f.startMode === "date" && f.startDate ? { startsAt: new Date(f.startDate + "T07:00:00").toISOString() } as object : {}),
        maxCycles: f.endMode === "count" ? f.cycles : null, endsAt: f.endMode === "date" && f.endDate ? new Date(f.endDate + "T23:59:59").toISOString() : null,
      });
      toast(r.issued ? `Plan created — ${r.issued} fresh code${r.issued > 1 ? "s" : ""} emailed to ${f.email}` : "Plan created — first codes will be sent on the start date");
      setModal(false); setF({ ...f, name: "", org: "", email: "" });
    } catch (err) { toast(errMsg(err), "error"); }
    setBusy(null);
  };

  const TABS = [["all", "All"], ["active", "Active"], ["paused", "Paused"], ["completed", "Completed"], ["cancelled", "Cancelled"]] as const;
  const count = (k: string) => (k === "all" ? plans.length : plans.filter((p) => p.status === k).length);

  return (
    <>
      <div className="pagehead">
        <div><h1>Recurring spins</h1><p>Give your best clients a fresh spin automatically. Each period the system creates a brand-new one-time code and emails it — nothing to remember.</p></div>
        {admin && (
          <div className="page-actions">
            <button className="btn btn-ghost" disabled={busy === "run"} onClick={() => run("run", async () => { const s = await runRenewals(); toast(s.plansRun ? `Renewals run — ${s.codesIssued} codes issued` : "Nothing due right now"); }, "")}>{busy === "run" ? <span className="spinner" /> : <><Zap size={15} /> Run renewals now</>}</button>
            <button className="btn btn-gold" onClick={() => setModal(true)}><Plus size={17} /> New recurring plan</button>
          </div>
        )}
      </div>
      {!admin && <div className="banner"><Lock size={18} /> Only admins can create or change recurring plans, because they affect prize cost. You can view them here.</div>}

      <div className="kpis" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {[
          { l: "Active plans", v: stats.active, i: Repeat, s: `${stats.paused} paused` },
          { l: "Codes auto-issued", v: stats.issued, i: Ticket, s: "All time" },
          { l: "Next renewal", v: stats.next ? fmtRelative(new Date(stats.next).toISOString()).replace("in ", "") : "—", i: CalendarClock, s: stats.next ? fmtDate(new Date(stats.next).toISOString()) : "No active plans" },
          { l: "Runs automatically", v: "Daily", i: Sparkles, s: "07:00 UTC · emails sent for you" },
        ].map((k, i) => (
          <motion.div key={k.l} className="glass kpi" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <div className="ico"><k.i size={17} /></div><div className="lbl">{k.l}</div><div className="val" style={{ fontSize: typeof k.v === "string" ? 26 : 34 }}>{k.v}</div><div className="kfoot"><span className="sub">{k.s}</span></div>
          </motion.div>
        ))}
      </div>

      <div className="seg" role="tablist" style={{ margin: "18px 0 14px", maxWidth: "100%", overflowX: "auto" }}>
        {TABS.map(([k, l]) => (<button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{tab === k && <motion.span layoutId="plantab" className="seg-pill" />}<span>{l}</span><span className="n">{count(k)}</span></button>))}
      </div>

      <div className="glass tablewrap">
        <table>
          <thead><tr><th>Recipient</th><th>Schedule</th><th>Progress</th><th>Next renewal</th><th>Status</th><th /></tr></thead>
          <tbody>
            {shown.map((p) => {
              const pct = p.maxCycles ? Math.min(100, (p.cyclesDone / p.maxCycles) * 100) : null;
              return (
                <motion.tr key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} onClick={() => setSel(p.id)}>
                  <td><b>{p.name}</b><div className="sub">{p.org || "—"} · {p.email}</div></td>
                  <td><div>{FREQ_LABEL[p.frequency]}</div><div className="sub">{p.spinsPerCycle} fresh code{p.spinsPerCycle > 1 ? "s" : ""} each time</div></td>
                  <td style={{ minWidth: 150 }}>
                    <div style={{ fontSize: 13 }}><b>{p.cyclesDone}</b>{p.maxCycles ? ` of ${p.maxCycles} renewals` : ` renewal${p.cyclesDone === 1 ? "" : "s"} · ongoing`}</div>
                    {pct != null && <div className="usebar" style={{ marginTop: 6 }}><motion.i initial={{ width: 0 }} animate={{ width: `${pct}%` }} /></div>}
                  </td>
                  <td>{p.status === "active" ? <><div>{fmtDate(p.nextRunAt)}</div><div className="sub">{fmtRelative(p.nextRunAt)}</div></> : <span style={{ color: "var(--dim)" }}>—</span>}</td>
                  <td><span className={`chip ${CHIP[p.status]}`}>{p.status[0].toUpperCase() + p.status.slice(1)}</span></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {admin && (
                      <div className="row-actions">
                        {p.status === "active" && <button className="icon-btn" title="Issue next cycle now" aria-label="Issue now" disabled={busy === p.id} onClick={() => run(p.id, () => planAction(p.id, "issue-now"), "Next cycle issued and emailed")}><Send size={15} /></button>}
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
            <p style={{ fontSize: 13.5 }}>Create one to automatically send a fresh spin code every week, fortnight or month.</p>
            {admin && <button className="btn btn-gold btn-sm" style={{ marginTop: 14 }} onClick={() => setModal(true)}><Plus size={15} /> New recurring plan</button>}</div>
        )}
      </div>

      {/* How it works */}
      <div className="glass card" style={{ marginTop: 18 }}>
        <h3>How auto-renewal works</h3>
        <div className="how">
          {[[CalendarClock, "On schedule", "Every day the system checks which plans are due."], [Ticket, "Fresh code(s)", "A brand-new, unique one-time code is created — 1 or 2 per renewal."], [Mail, "Emailed for you", "The client gets a “your new spin is ready” email with a link that pre-fills the code."], [Check, "Same safety as always", "Each code works once, expires, and is tracked in the audit log."]].map(([I, t, d], i) => {
            const Icon = I as typeof Mail;
            return <div key={i}><span className="rico" style={{ margin: 0, width: 38, height: 38 }}><Icon size={17} /></span><b>{t as string}</b><small>{d as string}</small></div>;
          })}
        </div>
      </div>

      {/* Create */}
      <AnimatePresence>
        {modal && (
          <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModal(false)}>
            <motion.form className="modal wide" onSubmit={submit} onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ type: "spring", stiffness: 300, damping: 28 }}>
              <button type="button" className="icon-btn" style={{ position: "absolute", right: 18, top: 18 }} onClick={() => setModal(false)} aria-label="Close"><X size={16} /></button>
              <span className="eyebrow"><Repeat size={13} /> Auto-renewal</span>
              <h2 style={{ fontSize: 24, margin: "14px 0 4px" }}>New recurring plan</h2>
              <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 18 }}>A fresh one-time code is created and emailed automatically each period.</p>

              <div className="formgrid">
                <div className="field"><label htmlFor="rn">Recipient name *</label><input id="rn" className="input" required autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Sarah Mitchell" /></div>
                <div className="field"><label htmlFor="ro">Organisation</label><input id="ro" className="input" value={f.org} onChange={(e) => setF({ ...f, org: e.target.value })} placeholder="e.g. Brightwave Ltd" /></div>
                <div className="field full"><label htmlFor="re">Email address * <span style={{ fontWeight: 400, color: "var(--dim)" }}>— renewals are sent here automatically</span></label><input id="re" type="email" className="input" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@company.co.uk" style={f.email && !emailOk ? { borderColor: "var(--red)" } : undefined} /></div>

                <div className="field"><label>How often</label>
                  <div className="seg">{(["weekly", "fortnightly", "monthly"] as Frequency[]).map((x) => (<button type="button" key={x} className={f.frequency === x ? "on" : ""} onClick={() => setF({ ...f, frequency: x, validity: Math.max(STEP_DAYS[x], 7) })}>{f.frequency === x && <motion.span layoutId="freq" className="seg-pill" />}<span>{x === "weekly" ? "Weekly" : x === "fortnightly" ? "2 weeks" : "Monthly"}</span></button>))}</div></div>
                <div className="field"><label>Spins each time</label>
                  <div className="seg">{[1, 2].map((n) => (<button type="button" key={n} className={f.spins === n ? "on" : ""} onClick={() => setF({ ...f, spins: n })}>{f.spins === n && <motion.span layoutId="spins" className="seg-pill" />}<span>{n} spin{n > 1 ? "s" : ""}</span></button>))}</div></div>

                <div className="field"><label htmlFor="rv">Each code is valid for</label>
                  <select id="rv" className="input" value={f.validity} onChange={(e) => setF({ ...f, validity: +e.target.value })}>{[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>{d} days</option>)}</select></div>
                <div className="field"><label>First codes sent</label>
                  <div className="seg">{(["now", "date"] as const).map((m) => (<button type="button" key={m} className={f.startMode === m ? "on" : ""} onClick={() => setF({ ...f, startMode: m })}>{f.startMode === m && <motion.span layoutId="start" className="seg-pill" />}<span>{m === "now" ? "Immediately" : "On a date"}</span></button>))}</div>
                  {f.startMode === "date" && <input type="date" className="input" style={{ marginTop: 8 }} min={new Date().toISOString().slice(0, 10)} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} aria-label="Start date" />}</div>

                <div className="field full"><label>Ends</label>
                  <div className="seg" style={{ width: "fit-content" }}>{([["count", "After a number of renewals"], ["date", "On a date"], ["ongoing", "Never (until cancelled)"]] as const).map(([m, l]) => (<button type="button" key={m} className={f.endMode === m ? "on" : ""} onClick={() => setF({ ...f, endMode: m })}>{f.endMode === m && <motion.span layoutId="end" className="seg-pill" />}<span>{l}</span></button>))}</div>
                  {f.endMode === "count" && <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}><input type="number" min={1} max={60} className="input" style={{ width: 100 }} value={f.cycles} onChange={(e) => setF({ ...f, cycles: Math.max(1, Math.min(60, +e.target.value || 1)) })} aria-label="Number of renewals" /><span style={{ color: "var(--muted)", fontSize: 14 }}>renewals</span></div>}
                  {f.endMode === "date" && <input type="date" className="input" style={{ marginTop: 8, width: 200 }} min={new Date().toISOString().slice(0, 10)} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} aria-label="End date" />}</div>
              </div>

              <div className="summary">
                <Sparkles size={16} />
                <div>
                  <b>{f.name.trim() || "The recipient"}</b> will receive <b>{f.spins} fresh code{f.spins > 1 ? "s" : ""}</b> {f.frequency === "weekly" ? "every week" : f.frequency === "fortnightly" ? "every 2 weeks" : "every month"}
                  {f.startMode === "now" ? ", starting today" : f.startDate ? `, starting ${fmtDate(preview.start.toISOString())}` : ""}
                  {f.endMode === "ongoing" ? ", until you cancel." : preview.endsOn ? `, finishing around ${fmtDate(preview.endsOn.toISOString())}.` : "."}
                  {preview.total != null && <span className="exposure"> Maximum prize exposure: <b>{preview.total} spin{preview.total === 1 ? "" : "s"}</b>.</span>}
                  {f.endMode === "ongoing" && <span className="exposure"> No end date means no cap on total spins.</span>}
                </div>
              </div>
              <button className="btn btn-gold btn-lg" style={{ width: "100%", marginTop: 18 }} disabled={!valid || busy === "create"}>{busy === "create" ? <span className="spinner" /> : <><Repeat size={18} /> Create plan{f.startMode === "now" ? " & send first codes" : ""}</>}</button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail */}
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
                <dt>Schedule</dt><dd>{FREQ_LABEL[selected.frequency]} · {selected.spinsPerCycle} code{selected.spinsPerCycle > 1 ? "s" : ""}</dd>
                <dt>Code validity</dt><dd>{selected.codeValidityDays} days</dd>
                <dt>Started</dt><dd>{fmtDate(selected.startsAt)}</dd>
                <dt>Next renewal</dt><dd>{selected.status === "active" ? `${fmtDate(selected.nextRunAt)} (${fmtRelative(selected.nextRunAt)})` : "—"}</dd>
                <dt>Ends</dt><dd>{selected.maxCycles ? `After ${selected.maxCycles} renewals` : selected.endsAt ? fmtDate(selected.endsAt) : "Until cancelled"}</dd>
                <dt>Created by</dt><dd>{selected.createdBy}</dd>
              </dl>
              <h3 style={{ fontSize: 15, margin: "26px 0 8px" }}>Codes issued ({selCodes.length})</h3>
              {selCodes.length === 0 && <p style={{ color: "var(--dim)", fontSize: 14 }}>No codes issued yet.</p>}
              <div style={{ display: "grid", gap: 8 }}>
                {selCodes.map((c) => { const s = effectiveStatus(c); return (
                  <div key={c.id} className="plan-code"><div><span className="mono">{c.code}</span><small>Renewal #{c.cycleNo} · {fmtDate(c.createdAt)}{c.emailedAt ? " · emailed" : " · not emailed"}</small></div><span className={`chip ${s}`}>{s}</span></div>
                ); })}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
