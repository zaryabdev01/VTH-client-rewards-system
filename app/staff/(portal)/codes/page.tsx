"use client";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowDown, ArrowUp, Ban, Check, CheckCheck, ChevronLeft, ChevronRight, Copy, Download, Mail, Plus, Search, Send, Sparkles, X, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { effectiveStatus, fmtDate, fmtDateTime, fmtRelative, STAFF, useStore, type Code } from "@/lib/store";

type SortKey = "name" | "createdAt" | "expiresAt";
const PAGE = 10;
const DAY = 864e5;

export default function Codes() {
  const { codes, rewards, user, settings, generateCode, sendCode, cancelCode, fulfil } = useStore();
  const toast = useToast();
  const [q, setQ] = useState(""); const [tab, setTab] = useState("all"); const [reward, setReward] = useState("all"); const [emp, setEmp] = useState("all"); const [range, setRange] = useState("all");
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "createdAt", dir: -1 });
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState(false);
  const [created, setCreated] = useState<Code | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Code | null>(null);
  const [form, setForm] = useState({ name: "", org: "", email: "", days: settings.defaultExpiry, sendNow: true });
  const [sending, setSending] = useState(false);
  const canExpiry = user?.role === "admin" || settings.staffCanChangeExpiry;

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new")) setModal(true);
    const open = () => setModal(true);
    window.addEventListener("vth:new-code", open);
    return () => window.removeEventListener("vth:new-code", open);
  }, []);
  useEffect(() => setPage(0), [q, tab, reward, emp, range, sort]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: codes.length, active: 0, used: 0, expired: 0, cancelled: 0 };
    codes.forEach((x) => c[effectiveStatus(x)]++);
    return c;
  }, [codes]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = codes.filter((c) => {
      const s = effectiveStatus(c);
      if (tab !== "all" && s !== tab) return false;
      if (reward !== "all" && String(c.rewardId) !== reward) return false;
      if (emp !== "all" && c.createdBy !== emp) return false;
      if (range !== "all" && Date.now() - new Date(c.createdAt).getTime() > Number(range) * DAY) return false;
      return !t || [c.name, c.org, c.email, c.code, c.ref ?? ""].some((x) => x.toLowerCase().includes(t));
    });
    return list.sort((a, b) => (sort.k === "name" ? a.name.localeCompare(b.name) : +new Date(a[sort.k]) - +new Date(b[sort.k])) * sort.dir);
  }, [codes, q, tab, reward, emp, range, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const filtered = q || reward !== "all" || emp !== "all" || range !== "all";
  const clearFilters = () => { setQ(""); setReward("all"); setEmp("all"); setRange("all"); setTab("all"); };

  const copy = async (code: string) => { try { await navigator.clipboard.writeText(code); } catch {} toast(`Copied ${code}`); };
  const send = async (c: Code) => { setSending(true); await new Promise((r) => setTimeout(r, 800)); sendCode(c.id, c); setSending(false); toast(`Code emailed to ${c.email || c.name}`); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = generateCode({ name: form.name.trim(), org: form.org.trim(), email: form.email.trim(), days: form.days });
    setCreated(c);
    if (form.sendNow && c.email) { await send(c); }
    setForm({ name: "", org: "", email: "", days: settings.defaultExpiry, sendNow: true });
  };
  const closeModal = () => { setModal(false); setCreated(null); };
  const live = created ? codes.find((c) => c.id === created.id) ?? created : null;
  const selected = codes.find((c) => c.id === sel) ?? null;
  const rname = (id?: number) => rewards.find((r) => r.id === id)?.name ?? "—";
  const toggleSort = (k: SortKey) => setSort((s) => (s.k === k ? { k, dir: (s.dir * -1) as 1 | -1 } : { k, dir: k === "name" ? 1 : -1 }));
  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th><button className="th-sort" onClick={() => toggleSort(k)}>{children}{sort.k === k ? (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowDown size={12} style={{ opacity: 0.25 }} />}</button></th>
  );
  const emailOk = !form.email || /^\S+@\S+\.\S+$/.test(form.email);

  const exportCsv = () => {
    const head = "Code,Name,Organisation,Email,Status,Reward,Reference,Fulfilment,Created,Expires\n";
    const body = rows.map((c) => [c.code, c.name, c.org, c.email, effectiveStatus(c), rname(c.rewardId), c.ref ?? "", c.fulfilment ?? "", c.createdAt, c.expiresAt].map((v) => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([head + body], { type: "text/csv" })); a.download = "vth-codes.csv"; a.click(); toast(`Exported ${rows.length} rows`);
  };

  const expiryCell = (c: Code) => {
    const s = effectiveStatus(c);
    const left = new Date(c.expiresAt).getTime() - Date.now();
    return (
      <>
        <div>{fmtDate(c.expiresAt)}</div>
        {s === "active" && <div className={`sub ${left < 2 * DAY ? "soon" : ""}`}>{left < 2 * DAY && <AlertTriangle size={11} style={{ verticalAlign: -1, marginRight: 3 }} />}{fmtRelative(c.expiresAt)}</div>}
      </>
    );
  };

  const TABS = [["all", "All"], ["active", "Active"], ["used", "Used"], ["expired", "Expired"], ["cancelled", "Cancelled"]] as const;

  return (
    <>
      <div className="pagehead">
        <div><h1>Codes &amp; history</h1><p>Generate one-time codes, email them, and track every redemption.</p></div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={exportCsv}><Download size={16} /> Export CSV</button>
          <button className="btn btn-gold" onClick={() => setModal(true)}><Plus size={17} /> GENERATE NEW SPIN CODE</button>
        </div>
      </div>

      <div className="seg tabs-seg" role="tablist" style={{ marginBottom: 14, maxWidth: "100%", overflowX: "auto" }}>
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {tab === k && <motion.span layoutId="codetab" className="seg-pill" />}<span>{l}</span><span className="n">{counts[k]}</span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <div className="search"><Search size={17} /><input className="input" placeholder="Search recipient, organisation, email, code or reference…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="input" value={reward} onChange={(e) => setReward(e.target.value)} aria-label="Reward"><option value="all">All rewards</option>{rewards.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <select className="input" value={emp} onChange={(e) => setEmp(e.target.value)} aria-label="Employee"><option value="all">All employees</option>{STAFF.map((s) => <option key={s}>{s}</option>)}</select>
        <select className="input" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Date"><option value="all">Any date</option><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select>
        {(filtered || tab !== "all") && <button className="btn btn-ghost btn-sm" onClick={clearFilters}><X size={14} /> Clear</button>}
      </div>

      <div className="glass tablewrap">
        <table>
          <thead><tr><Th k="name">Recipient</Th><th>Code</th><th>Status</th><th>Reward</th><Th k="createdAt">Created</Th><Th k="expiresAt">Expires</Th><th /></tr></thead>
          <tbody>
            {shown.map((c) => {
              const s = effectiveStatus(c);
              return (
                <motion.tr key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} onClick={() => setSel(c.id)}>
                  <td><b>{c.name}</b><div className="sub">{c.org || "—"}</div></td>
                  <td><span className="mono">{c.code}</span></td>
                  <td><span className={`chip ${s}`}>{s[0].toUpperCase() + s.slice(1)}</span> {c.emailedAt && s === "active" && <span title={`Emailed ${fmtDateTime(c.emailedAt)}`} style={{ color: "var(--dim)", verticalAlign: -2 }}><Mail size={14} /></span>}</td>
                  <td>{c.rewardId ? <><div>{rname(c.rewardId)}</div><span className={`chip ${c.fulfilment}`} style={{ marginTop: 4 }}>{c.fulfilment}</span></> : <span style={{ color: "var(--dim)" }}>—</span>}</td>
                  <td><div>{fmtDate(c.createdAt)}</div><div className="sub">by {c.createdBy}</div></td>
                  <td>{expiryCell(c)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row-actions">
                      <button className="icon-btn" title="Copy code" aria-label="Copy code" onClick={() => copy(c.code)}><Copy size={15} /></button>
                      {s === "active" && <button className="icon-btn" title={c.emailedAt ? "Resend code" : "Send code"} aria-label="Send code" onClick={() => send(c)}><Send size={15} /></button>}
                      {s === "used" && c.fulfilment === "pending" && <button className="icon-btn" title="Mark fulfilled" aria-label="Mark fulfilled" style={{ color: "var(--green)" }} onClick={() => { fulfil(c.id); toast("Marked as fulfilled"); }}><CheckCheck size={16} /></button>}
                      {s === "active" && <button className="icon-btn" title="Cancel code" aria-label="Cancel code" style={{ color: "var(--red)" }} onClick={() => setConfirm(c)}><Ban size={15} /></button>}
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="empty"><Search size={30} style={{ opacity: 0.4 }} /><p style={{ marginTop: 10, fontWeight: 500, color: "var(--text)" }}>No codes match</p><p style={{ fontSize: 13.5 }}>Try a different search or clear the filters.</p><button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={clearFilters}>Clear filters</button></div>
        )}
      </div>

      <div className="pager">
        <span>{rows.length === 0 ? "0 codes" : `${page * PAGE + 1}–${Math.min(rows.length, page * PAGE + PAGE)} of ${rows.length} codes`}</span>
        <div>
          <button className="icon-btn" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
          <span style={{ margin: "0 12px" }}>Page {page + 1} of {pages}</span>
          <button className="icon-btn" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Generate modal */}
      <AnimatePresence>
        {modal && (
          <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal}>
            <motion.div className="modal" onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }} transition={{ type: "spring", stiffness: 300, damping: 28 }}>
              <button className="icon-btn" style={{ position: "absolute", right: 18, top: 18 }} onClick={closeModal} aria-label="Close"><X size={16} /></button>
              <AnimatePresence mode="wait" initial={false}>
                {!live ? (
                  <motion.form key="f" onSubmit={submit} exit={{ opacity: 0, x: -20 }}>
                    <span className="eyebrow"><Sparkles size={13} /> New code</span>
                    <h2 style={{ fontSize: 24, margin: "14px 0 4px" }}>Generate a spin code</h2>
                    <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>Issue a one-time code during a client call. No waiting period between codes.</p>
                    <div className="formgrid">
                      <div className="field"><label htmlFor="gn">Recipient name *</label><input id="gn" className="input" required autoFocus placeholder="e.g. Sarah Mitchell" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                      <div className="field"><label htmlFor="go">Organisation</label><input id="go" className="input" placeholder="e.g. Brightwave Ltd" value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value })} /></div>
                      <div className="field"><label htmlFor="ge">Email address</label><input id="ge" className="input" type="email" placeholder="Optional" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={!emailOk ? { borderColor: "var(--red)" } : undefined} />{!emailOk && <small style={{ color: "var(--red)" }}>Enter a valid email address</small>}</div>
                      <div className="field"><label htmlFor="gx">Expires after</label>
                        <select id="gx" className="input" disabled={!canExpiry} value={form.days} onChange={(e) => setForm({ ...form, days: +e.target.value })}><option value={1}>24 hours</option><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select>
                        {!canExpiry && <small style={{ color: "var(--dim)" }}>Set by admin ({settings.defaultExpiry} days)</small>}</div>
                      <label className="full check"><input type="checkbox" checked={form.sendNow && !!form.email} disabled={!form.email} onChange={(e) => setForm({ ...form, sendNow: e.target.checked })} /><span><b>Email the code immediately</b><small>{form.email ? `Sends the branded code email to ${form.email}` : "Add an email address to send straight away — otherwise read the code out on the call."}</small></span></label>
                    </div>
                    <button className="btn btn-gold btn-lg" style={{ width: "100%", marginTop: 20 }} disabled={!emailOk || !form.name.trim()}><Sparkles size={18} /> Generate{form.sendNow && form.email ? " & send" : ""} code</button>
                  </motion.form>
                ) : (
                  <motion.div key="r" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}>
                    <motion.div className="tick" style={{ marginBottom: 14 }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 12 }}><Check size={26} strokeWidth={3} /></motion.div>
                    <h2 style={{ fontSize: 24 }}>Code ready for {live.name.split(" ")[0]}</h2>
                    <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>Valid until {fmtDate(live.expiresAt)} · one spin only.{live.emailedAt && <> Emailed to <b>{live.email}</b>.</>}</p>
                    <motion.div className="bigcode" initial={{ scale: 0.92 }} animate={{ scale: 1 }}><b>{live.code}</b></motion.div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => copy(live.code)}><Copy size={16} /> Copy</button>
                      <button className="btn btn-primary" style={{ flex: 1.4 }} disabled={sending || !live.email} onClick={() => send(live)}>
                        {sending ? <span className="spinner" /> : live.emailedAt ? <><Check size={16} /> Sent — resend</> : <><Send size={16} /> Send code</>}
                      </button>
                    </div>
                    {!live.email && <p style={{ fontSize: 12.5, color: "var(--dim)", marginTop: 12 }}>No email address — read the code out to the client on the call.</p>}
                    <button className="btn btn-ghost" style={{ width: "100%", marginTop: 12 }} onClick={() => setCreated(null)}>Issue another code</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel confirmation */}
      <AnimatePresence>
        {confirm && (
          <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirm(null)}>
            <motion.div className="modal" style={{ width: "min(100%, 440px)" }} onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}>
              <div className="tick" style={{ background: "rgba(217,114,111,.1)", borderColor: "rgba(217,114,111,.4)", color: "var(--red)", marginBottom: 14 }}><XCircle size={24} /></div>
              <h2 style={{ fontSize: 22 }}>Cancel this code?</h2>
              <p style={{ color: "var(--muted)", margin: "8px 0 4px" }}><b className="mono">{confirm.code}</b> for {confirm.name} will stop working immediately. This can’t be undone.</p>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirm(null)}>Keep code</button>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => { cancelCode(confirm.id); setConfirm(null); toast("Code cancelled"); }}><Ban size={15} /> Cancel code</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div className="drawer-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSel(null)} />
            <motion.aside className="drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 34 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div><span className={`chip ${effectiveStatus(selected)}`}>{effectiveStatus(selected)}</span><h2 style={{ fontSize: 24, marginTop: 12 }}>{selected.name}</h2><p style={{ color: "var(--muted)" }}>{selected.org}</p></div>
                <button className="icon-btn" onClick={() => setSel(null)} aria-label="Close"><X size={16} /></button>
              </div>
              <div className="bigcode"><b style={{ fontSize: 24 }}>{selected.code}</b></div>
              <dl className="kv">
                <dt>Email</dt><dd>{selected.email || "—"}</dd><dt>Issued by</dt><dd>{selected.createdBy}</dd>
                <dt>Expires</dt><dd>{fmtDate(selected.expiresAt)}</dd>
                <dt>Reward</dt><dd>{rname(selected.rewardId)}</dd><dt>Reference</dt><dd className="mono">{selected.ref ?? "—"}</dd>
              </dl>
              <h3 style={{ fontSize: 15, margin: "26px 0 4px" }}>Audit trail</h3>
              <div className="timeline">
                <div className="tl"><i /><div>Code generated<small>{fmtDateTime(selected.createdAt)} · {selected.createdBy}</small></div></div>
                {selected.emailedAt && <div className="tl"><i /><div>Code emailed<small>{fmtDateTime(selected.emailedAt)} · {selected.email}</small></div></div>}
                {selected.usedAt && <div className="tl"><i style={{ background: "var(--gold)" }} /><div>Spun &amp; redeemed — {rname(selected.rewardId)}<small>{fmtDateTime(selected.usedAt)}</small></div></div>}
                {selected.fulfilment === "fulfilled" && <div className="tl"><i style={{ background: "var(--green)" }} /><div>Reward marked fulfilled<small>VTH team</small></div></div>}
                {selected.status === "cancelled" && <div className="tl"><i style={{ background: "var(--red)" }} /><div>Code cancelled</div></div>}
                {effectiveStatus(selected) === "expired" && <div className="tl"><i style={{ background: "var(--amber)" }} /><div>Code expired<small>{fmtDateTime(selected.expiresAt)}</small></div></div>}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
                <button className="btn btn-ghost" onClick={() => copy(selected.code)}><Copy size={15} /> Copy</button>
                {effectiveStatus(selected) === "active" && <button className="btn btn-primary" onClick={() => send(selected)}><Send size={15} /> {selected.emailedAt ? "Resend" : "Send"} code</button>}
                {selected.status === "used" && selected.fulfilment === "pending" && <button className="btn btn-gold" onClick={() => { fulfil(selected.id); toast("Marked as fulfilled"); }}><CheckCheck size={16} /> Mark fulfilled</button>}
                {effectiveStatus(selected) === "active" && <button className="btn btn-danger" onClick={() => { setConfirm(selected); setSel(null); }}><Ban size={15} /> Cancel code</button>}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
