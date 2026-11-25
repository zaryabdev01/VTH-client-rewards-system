"use client";
import { motion } from "framer-motion";
import { CheckCheck, Download, KeyRound, PartyPopper, Pencil, Repeat, Search, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { useStore } from "@/lib/store";
import { fmtDateTime, type Activity } from "@/lib/shared";

const ICON = { code: KeyRound, email: Send, spin: PartyPopper, reward: Pencil, fulfil: CheckCheck, plan: Repeat, accept: CheckCheck } as const;
const LABEL: Record<Activity["kind"], string> = { code: "Code", email: "Email", spin: "Spin", reward: "Settings", fulfil: "Fulfilment", plan: "Recurring", accept: "Accepted" };
const FILTERS = [["all", "All"], ["code", "Codes"], ["email", "Emails"], ["spin", "Spins"], ["accept", "Accepted"], ["fulfil", "Fulfilment"], ["plan", "Recurring"], ["reward", "Settings"]] as const;

const dayLabel = (iso: string) => {
  const d = new Date(iso), t = new Date(); const y = new Date(); y.setDate(t.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  return same(d, t) ? "Today" : same(d, y) ? "Yesterday" : d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
};

export default function ActivityLog() {
  const { activity } = useStore();
  const toast = useToast();
  const [kind, setKind] = useState<string>("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return activity.filter((a) => (kind === "all" || a.kind === kind) && (!t || `${a.who} ${a.text}`.toLowerCase().includes(t)));
  }, [activity, kind, q]);
  const groups = useMemo(() => {
    const m = new Map<string, Activity[]>();
    rows.forEach((a) => { const k = dayLabel(a.at); m.set(k, [...(m.get(k) ?? []), a]); });
    return [...m.entries()];
  }, [rows]);

  const exportCsv = () => {
    const body = rows.map((a) => [a.at, a.who, LABEL[a.kind], a.text].map((v) => `"${v}"`).join(",")).join("\n");
    const el = document.createElement("a"); el.href = URL.createObjectURL(new Blob(["Time,Actor,Type,Action\n" + body], { type: "text/csv" })); el.download = "vth-audit-log.csv"; el.click(); toast(`Exported ${rows.length} entries`);
  };

  return (
    <>
      <div className="pagehead">
        <div><h1>Activity log</h1><p>A complete audit trail of code, reward and settings changes — who did what, and when.</p></div>
        <button className="btn btn-ghost" onClick={exportCsv}><Download size={16} /> Export CSV</button>
      </div>
      <div className="toolbar">
        <div className="seg" role="tablist" style={{ maxWidth: "100%", overflowX: "auto" }}>
          {FILTERS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>{kind === k && <motion.span layoutId="actpill" className="seg-pill" />}<span>{l}</span></button>
          ))}
        </div>
        <div className="search"><Search size={17} /><input className="input" placeholder="Search people or actions…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>

      {groups.length === 0 && <div className="glass empty"><Search size={28} style={{ opacity: 0.4 }} /><p style={{ marginTop: 10 }}>No activity matches.</p></div>}
      {groups.map(([day, items], gi) => (
        <motion.div key={day} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gi * 0.06 }} style={{ marginBottom: 20 }}>
          <div className="day-h">{day}<span>{items.length}</span></div>
          <div className="glass" style={{ padding: "6px 8px" }}>
            {items.map((a) => { const I = ICON[a.kind]; return (
              <div className="log-row" key={a.id}>
                <div className="feed-ico"><I size={15} color="var(--violet-2)" /></div>
                <div className="log-main"><b>{a.who}</b> {a.text}</div>
                <span className="chip neutral">{LABEL[a.kind]}</span>
                <time>{fmtDateTime(a.at)}</time>
              </div>
            ); })}
          </div>
        </motion.div>
      ))}
    </>
  );
}
