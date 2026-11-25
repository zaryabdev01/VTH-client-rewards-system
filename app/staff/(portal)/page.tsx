"use client";
import { animate, motion, useInView } from "framer-motion";
import { AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight, CheckCheck, Clock, Gift, KeyRound, Mail, PartyPopper, Pencil, Repeat, Send, TicketCheck, TimerOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { errMsg, useStore } from "@/lib/store";
import { effectiveStatus, fmtRelative, timeAgo } from "@/lib/shared";

function Count({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => { if (inView) { const c = animate(0, to, { duration: 1.1, ease: "easeOut", onUpdate: (x) => setV(Math.round(x)) }); return () => c.stop(); } }, [inView, to]);
  return <span ref={ref}>{v}</span>;
}

function Spark({ data, color }: { data: number[]; color: string }) {
  const w = 84, h = 36, max = Math.max(...data, 1);
  const pts = data.map((d, i) => [(i / Math.max(1, data.length - 1)) * w, h - 6 - (d / max) * (h - 14)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  const id = `s${color.slice(1)}`;
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop stopColor={color} stopOpacity=".3" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L${w},${h} L0,${h}Z`} fill={`url(#${id})`} />
      <motion.path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: "easeOut" }} />
    </svg>
  );
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const inRange = (iso: string | undefined, from: number, to: number) => !!iso && new Date(iso).getTime() >= from && new Date(iso).getTime() < to;
const DAY = 864e5;

export default function Dashboard() {
  const { codes, rewards, activity, user, sendCode, fulfil, staffNames } = useStore();
  const toast = useToast();
  const [range, setRange] = useState<7 | 14 | 30>(14);
  const [hover, setHover] = useState<number | null>(null);

  const d = useMemo(() => {
    const now = Date.now(), start = now - range * DAY, prevStart = start - range * DAY;
    const st = (c: (typeof codes)[number]) => effectiveStatus(c);
    const gen = codes.filter((c) => inRange(c.createdAt, start, now + 1)).length;
    const genPrev = codes.filter((c) => inRange(c.createdAt, prevStart, start)).length;
    const used = codes.filter((c) => inRange(c.usedAt, start, now + 1)).length;
    const usedPrev = codes.filter((c) => inRange(c.usedAt, prevStart, start)).length;
    const days = Array.from({ length: range }, (_, i) => { const dt = new Date(); dt.setDate(dt.getDate() - (range - 1 - i)); return dt; });
    const issued = days.map((dt) => codes.filter((c) => dayKey(new Date(c.createdAt)) === dayKey(dt)).length);
    const redeemed = days.map((dt) => codes.filter((c) => c.usedAt && dayKey(new Date(c.usedAt)) === dayKey(dt)).length);
    const prizes = rewards.map((r) => ({ r, n: codes.filter((c) => c.rewardId === r.id).length })).filter((p) => p.n > 0).sort((a, b) => b.n - a.n);
    const usedAll = codes.filter((c) => c.status === "used");
    const pending = usedAll.filter((c) => c.fulfilment === "pending");
    const unsent = codes.filter((c) => st(c) === "active" && !c.emailedAt && c.email);
    const expiring = codes.filter((c) => st(c) === "active" && new Date(c.expiresAt).getTime() - now < 2 * DAY).sort((a, b) => +new Date(a.expiresAt) - +new Date(b.expiresAt));
    const staff = staffNames.map((n: string) => ({ n, c: codes.filter((c) => c.createdBy === n).length }));
    return {
      total: codes.length, emailed: codes.filter((c) => c.emailedAt).length, used: usedAll.length, active: codes.filter((c) => st(c) === "active").length,
      expired: codes.filter((c) => st(c) === "expired").length, cancelled: codes.filter((c) => c.status === "cancelled").length,
      gen, genPrev, usedR: used, usedPrev, days, issued, redeemed, prizes, pending, unsent, expiring, staff, fulfilled: usedAll.length - pending.length,
    };
  }, [codes, rewards, range, staffNames]);

  const delta = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 100));
  const Delta = ({ a, b }: { a: number; b: number }) => {
    if (b === 0) return <span className="sub">No earlier period to compare</span>;
    const v = delta(a, b); const up = v >= 0;
    return <span className={`delta ${up ? "up" : "down"}`}>{up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(v)}%<em> vs prev {range}d</em></span>;
  };

  const W = 640, H = 230, P = { l: 30, r: 10, t: 14, b: 28 };
  const max = Math.max(4, ...d.issued, ...d.redeemed);
  const x = (i: number) => P.l + (i / (range - 1)) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
  const smooth = (arr: number[]) => arr.reduce((s, v, i) => { if (!i) return `M${x(0)},${y(v)}`; const cx = (x(i - 1) + x(i)) / 2; return `${s} C${cx},${y(arr[i - 1])} ${cx},${y(v)} ${x(i)},${y(v)}`; }, "");
  const step = range > 14 ? 5 : 2;

  const palette = ["#7f8fd9", "#c9a96a", "#5fb3a1", "#c77d8f", "#6f9bd1"];
  const totalP = d.prizes.reduce((s, p) => s + p.n, 0) || 1;
  const R = 62, CIRC = 2 * Math.PI * R;
  let acc = 0;
  const maxStaff = Math.max(1, ...d.staff.map((s: { n: string; c: number }) => s.c));

  const kpis = [
    { l: "Codes generated", v: d.total, i: KeyRound, c: "#7f8fd9", foot: <Delta a={d.gen} b={d.genPrev} />, data: d.issued },
    { l: "Emailed", v: d.emailed, i: Mail, c: "#6f9bd1", foot: <span className="sub">{Math.round((d.emailed / Math.max(1, d.total)) * 100)}% of codes</span>, data: d.issued.map((v) => v * 0.8 + 0.2) },
    { l: "Used", v: d.used, i: TicketCheck, c: "#5fb3a1", foot: <Delta a={d.usedR} b={d.usedPrev} />, data: d.redeemed },
    { l: "Unused", v: d.active, i: Clock, c: "#c9a96a", foot: <span className="sub">Waiting to be spun</span>, data: d.issued.map((v, i) => Math.max(0, v - d.redeemed[i]) + 0.3) },
    { l: "Expired / cancelled", v: d.expired + d.cancelled, i: TimerOff, c: "#c98a62", foot: <span className="sub">{d.cancelled} cancelled</span>, data: d.issued.map((_, i) => ((i * 7) % 3) + 0.5) },
  ];
  const icon = { code: KeyRound, email: Send, spin: PartyPopper, reward: Pencil, fulfil: CheckCheck, plan: Repeat, accept: CheckCheck } as const;
  const funnel = [
    { l: "Generated", n: d.total, c: "#7f8fd9" }, { l: "Emailed", n: d.emailed, c: "#6f9bd1" },
    { l: "Redeemed", n: d.used, c: "#5fb3a1" }, { l: "Fulfilled", n: d.fulfilled, c: "#2f8a57" },
  ];
  const attention = d.pending.length + d.unsent.length + d.expiring.length;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const sendAll = async () => {
    const n = d.unsent.length;
    const r = await Promise.allSettled(d.unsent.map((c) => sendCode(c.id)));
    const bad = r.filter((x) => x.status === "rejected").length;
    if (bad) toast(`${bad} of ${n} emails failed to send`, "error"); else toast(`Emailed ${n} code${n > 1 ? "s" : ""}`);
  };

  return (
    <>
      <div className="pagehead">
        <div><h1>{greet}, {user?.name.split(" ")[0]}</h1><p>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · Here’s how Thank You Spin is performing.</p></div>
        <div className="seg" role="group" aria-label="Date range">
          {([7, 14, 30] as const).map((r) => (
            <button key={r} className={range === r ? "on" : ""} onClick={() => setRange(r)}>{range === r && <motion.span layoutId="rangepill" className="seg-pill" />}<span>{r} days</span></button>
          ))}
        </div>
      </div>

      <div className="kpis">
        {kpis.map((k, i) => (
          <motion.div key={k.l} className="glass kpi" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, duration: 0.45 }}>
            <div className="ico" style={{ color: k.c }}><k.i size={17} /></div>
            <div className="lbl">{k.l}</div>
            <div className="val"><Count to={k.v} /></div>
            <div className="kfoot">{k.foot}</div>
            <Spark data={k.data} color={k.c} />
          </motion.div>
        ))}
      </div>

      <div className="grid2">
        <motion.div className="glass card chartcard" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <h3>Codes issued vs redeemed <small>Last {range} days</small></h3>
          <div className="legend" style={{ marginTop: 10 }}><span><i style={{ background: "#7f8fd9" }} />Issued</span><span><i style={{ background: "#5fb3a1" }} />Redeemed</span></div>
          <div style={{ position: "relative", marginTop: 6 }} onMouseLeave={() => setHover(null)}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Codes issued versus redeemed over ${range} days`}>
              <defs>
                <linearGradient id="ga" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#7f8fd9" stopOpacity=".35" /><stop offset="1" stopColor="#7f8fd9" stopOpacity="0" /></linearGradient>
                <linearGradient id="gb" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#5fb3a1" stopOpacity=".3" /><stop offset="1" stopColor="#5fb3a1" stopOpacity="0" /></linearGradient>
              </defs>
              {[0, 0.25, 0.5, 0.75, 1].map((t) => (<g key={t}><line x1={P.l} x2={W - P.r} y1={y(max * t)} y2={y(max * t)} stroke="var(--line)" /><text x={P.l - 8} y={y(max * t) + 4} fontSize="10" fill="var(--dim)" textAnchor="end">{Math.round(max * t)}</text></g>))}
              <path d={`${smooth(d.issued)} L${x(range - 1)},${y(0)} L${x(0)},${y(0)}Z`} fill="url(#ga)" />
              <path d={`${smooth(d.redeemed)} L${x(range - 1)},${y(0)} L${x(0)},${y(0)}Z`} fill="url(#gb)" />
              <motion.path key={`i${range}`} d={smooth(d.issued)} fill="none" stroke="#7f8fd9" strokeWidth="2.2" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: "easeInOut" }} />
              <motion.path key={`r${range}`} d={smooth(d.redeemed)} fill="none" stroke="#5fb3a1" strokeWidth="2.2" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.15, ease: "easeInOut" }} />
              {d.days.map((dt, i) => (i % step === 0 || i === range - 1) && <text key={i} x={x(i)} y={H - 8} fontSize="10" fill="var(--dim)" textAnchor="middle">{dt.getDate()}/{dt.getMonth() + 1}</text>)}
              {hover != null && (<g><line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="var(--line-2)" strokeDasharray="3 3" /><circle cx={x(hover)} cy={y(d.issued[hover])} r="4.5" fill="#7f8fd9" stroke="#fff" strokeWidth="2" /><circle cx={x(hover)} cy={y(d.redeemed[hover])} r="4.5" fill="#5fb3a1" stroke="#fff" strokeWidth="2" /></g>)}
              {d.days.map((_, i) => <rect key={i} x={x(i) - (W / range) / 2} y={0} width={W / range} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />)}
            </svg>
            {hover != null && (
              <div className="tip" style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > range * 0.6 ? "-110%" : "10%"})` }}>
                <b>{d.days[hover].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</b><br />Issued: {d.issued[hover]} · Redeemed: {d.redeemed[hover]}
              </div>
            )}
          </div>
          <div className="stats-strip">
            <div><span>Issued</span><b>{d.issued.reduce((a, b) => a + b, 0)}</b></div>
            <div><span>Redeemed</span><b>{d.redeemed.reduce((a, b) => a + b, 0)}</b></div>
            <div><span>Avg per day</span><b>{(d.issued.reduce((a, b) => a + b, 0) / range).toFixed(1)}</b></div>
            <div><span>Redemption rate</span><b>{Math.round((d.redeemed.reduce((a, b) => a + b, 0) / Math.max(1, d.issued.reduce((a, b) => a + b, 0))) * 100)}%</b></div>
          </div>
        </motion.div>

        <motion.div className="glass card attn" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h3>Needs attention {attention > 0 && <span className="badge">{attention}</span>}</h3>
          {attention === 0 && <div className="empty" style={{ padding: "30px 0" }}><CheckCheck size={28} style={{ opacity: 0.6 }} /><p style={{ marginTop: 8 }}>You’re all caught up.</p></div>}
          {d.pending.length > 0 && (
            <div className="attn-sec">
              <div className="attn-h"><Gift size={14} /> {d.pending.length} reward{d.pending.length > 1 ? "s" : ""} awaiting fulfilment</div>
              {d.pending.slice(0, 3).map((c) => (
                <div className="attn-row" key={c.id}>
                  <span><b>{c.name}</b><small>{rewards.find((r) => r.id === c.rewardId)?.name} · {c.ref}</small></span>
                  <button className="btn btn-ghost btn-sm" onClick={async () => { try { await fulfil(c.id); toast(`Marked ${c.name.split(" ")[0]}’s reward fulfilled`); } catch (e) { toast(errMsg(e), "error"); } }}><CheckCheck size={14} /> Fulfil</button>
                </div>
              ))}
            </div>
          )}
          {d.expiring.length > 0 && (
            <div className="attn-sec">
              <div className="attn-h warn"><AlertCircle size={14} /> {d.expiring.length} code{d.expiring.length > 1 ? "s" : ""} expiring within 48h</div>
              {d.expiring.slice(0, 2).map((c) => (<div className="attn-row" key={c.id}><span><b>{c.name}</b><small>{c.org} · expires {fmtRelative(c.expiresAt)}</small></span><span className="chip expired">{fmtRelative(c.expiresAt)}</span></div>))}
            </div>
          )}
          {d.unsent.length > 0 && (
            <div className="attn-sec">
              <div className="attn-h"><Mail size={14} /> {d.unsent.length} code{d.unsent.length > 1 ? "s" : ""} not emailed yet</div>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={sendAll}><Send size={14} /> Send all now</button>
            </div>
          )}
          <Link href="/staff/codes" className="more">Open codes &amp; history <ArrowRight size={14} /></Link>
        </motion.div>
      </div>

      <div className="grid3">
        <motion.div className="glass card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <h3>Conversion funnel <small>All time</small></h3>
          <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
            {funnel.map((f, i) => (
              <div key={f.l}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "var(--muted)" }}>{f.l}</span><span><b>{f.n}</b>{i > 0 && <em style={{ fontStyle: "normal", color: "var(--dim)", marginLeft: 8 }}>{Math.round((f.n / Math.max(1, funnel[i - 1].n)) * 100)}%</em>}</span></div>
                <div style={{ height: 8, borderRadius: 8, background: "var(--surface-2)", marginTop: 6, overflow: "hidden" }}>
                  <motion.div style={{ height: "100%", background: f.c, borderRadius: 8 }} initial={{ width: 0 }} animate={{ width: `${(f.n / Math.max(1, d.total)) * 100}%` }} transition={{ duration: 0.9, delay: 0.4 + i * 0.1 }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div className="glass card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <h3>Prize breakdown <small>{d.used} spins</small></h3>
          <div className="donut-wrap">
            <svg width="130" height="130" viewBox="0 0 150 150" role="img" aria-label="Prize breakdown">
              <circle cx="75" cy="75" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="16" />
              {d.prizes.slice(0, 5).map((p, i) => {
                const len = (p.n / totalP) * CIRC; const off = acc; acc += len;
                return <motion.circle key={p.r.id} cx="75" cy="75" r={R} fill="none" stroke={palette[i]} strokeWidth="16" strokeDashoffset={-off} transform="rotate(-90 75 75)" initial={{ strokeDasharray: `0 ${CIRC}` }} animate={{ strokeDasharray: `${Math.max(0, len - 3)} ${CIRC}` }} transition={{ duration: 1, delay: 0.4 + i * 0.1 }} />;
              })}
              <text x="75" y="76" textAnchor="middle" fontSize="26" fontWeight="600" fill="var(--text)">{d.used}</text>
              <text x="75" y="94" textAnchor="middle" fontSize="10" fill="var(--muted)">REWARDS</text>
            </svg>
            <div style={{ display: "grid", gap: 7, fontSize: 12.5, flex: 1, minWidth: 120 }}>
              {d.prizes.slice(0, 5).map((p, i) => (<div key={p.r.id} style={{ display: "flex", gap: 8, alignItems: "center" }}><i style={{ width: 8, height: 8, borderRadius: 3, background: palette[i], flex: "none" }} /><span style={{ flex: 1, color: "var(--muted)" }}>{p.r.name}</span><b>{p.n}</b></div>))}
              {d.prizes.length === 0 && <span style={{ color: "var(--dim)" }}>No spins yet</span>}
            </div>
          </div>
        </motion.div>

        <motion.div className="glass card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <h3>Activity per employee <small>Codes issued</small></h3>
          {d.staff.map((s: { n: string; c: number }, i: number) => (
            <div className="bar-row" key={s.n}><span style={{ color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.n}</span>
              <div className="track"><motion.div className="fill" initial={{ width: 0 }} animate={{ width: `${(s.c / maxStaff) * 100}%` }} transition={{ duration: 0.9, delay: 0.5 + i * 0.08 }} /></div><b>{s.c}</b></div>
          ))}
        </motion.div>
      </div>

      <motion.div className="glass card" style={{ marginTop: 16 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <h3>Live activity <Link href="/staff/activity" className="more" style={{ margin: 0 }}>View full audit log <ArrowRight size={14} /></Link></h3>
        <div className="feed two">
          {activity.slice(0, 8).map((a) => { const I = icon[a.kind]; return (
            <div className="feed-item" key={a.id}><div className="feed-ico"><I size={15} color="var(--violet-2)" /></div><div><span><b>{a.who}</b> {a.text}</span><small>{timeAgo(a.at)}</small></div></div>
          ); })}
        </div>
      </motion.div>
    </>
  );
}
