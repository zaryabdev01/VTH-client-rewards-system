"use client";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { AlertTriangle, ArrowRight, CalendarX, Check, CheckCircle2, Copy, Gift, Info, KeyRound, Lock, Mail, ShieldCheck, Sparkles, Timer, XCircle, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Aurora, Logo } from "@/components/Brand";
import Confetti from "@/components/Confetti";
import Wheel, { ICONS, type WheelHandle } from "@/components/Wheel";
import { useToast } from "@/components/Toast";
import { fmtDate, formatCode, useStore, type Code, type Reward } from "@/lib/store";

type Phase = "enter" | "checking" | "ready" | "spinning" | "done";
type Err = { kind: "invalid" | "used" | "expired" | "cancelled" | "empty" | "limit"; code?: Code } | null;

export default function Home() {
  const { rewards, lookup, redeem, restoreFor, ready: storeReady } = useStore();
  const toast = useToast();
  const wheel = useRef<WheelHandle>(null);
  const stage = useRef<HTMLElement>(null);
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<Phase>("enter");
  const [err, setErr] = useState<Err>(null);
  const shakeCtl = useAnimationControls();
  const [fails, setFails] = useState(0);
  const [cool, setCool] = useState(0);
  const [active, setActive] = useState<Code | null>(null);
  const [result, setResult] = useState<{ reward: Reward; ref: string } | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const [restored, setRestored] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);

  useEffect(() => { if (cool > 0) { const t = setTimeout(() => setCool(cool - 1), 1000); return () => clearTimeout(t); } }, [cool]);

  const fail = (e: Err) => { setErr(e); shakeCtl.start({ x: [0, -9, 9, -7, 7, -3, 0], transition: { duration: 0.45 } }); setPhase("enter"); };

  const unlock = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (cool > 0) return;
    if (!value.trim()) return fail({ kind: "empty" });
    setErr(null); setPhase("checking");
    await new Promise((r) => setTimeout(r, 1100));
    // a code already redeemed in this browser restores the original result (connection-drop safety)
    const back = restoreFor(value);
    if (back) {
      setActive(back.code); setResult({ reward: back.reward, ref: back.code.ref! }); setRestored(true);
      setWinner(rewards.findIndex((r) => r.id === back.reward.id)); setPhase("done"); setShowReveal(true); return;
    }
    const res = lookup(value);
    if (!res.ok) {
      const nf = fails + 1; setFails(nf);
      if (nf >= 5) { setCool(30); setFails(0); return fail({ kind: "limit" }); }
      return fail({ kind: res.reason, code: res.code });
    }
    setActive(res.code); setPhase("ready");
  };

  const spin = async () => {
    if (phase !== "ready" || !active) return;
    setPhase("spinning");
    if (window.innerWidth < 960) stage.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    // server decides + records the result first; the wheel only animates to it
    const { code, reward } = redeem(active.id);
    const idx = rewards.findIndex((r) => r.id === reward.id);
    setResult({ reward, ref: code.ref! });
    await wheel.current?.spinTo(idx);
    setWinner(idx); setPhase("done");
    setTimeout(() => setShowReveal(true), 650);
  };

  const reset = () => { setPhase("enter"); setValue(""); setErr(null); setActive(null); setResult(null); setWinner(null); setShowReveal(false); setRestored(false); };
  const first = active?.name.split(" ")[0];
  const locked = phase === "enter" || phase === "checking";

  return (
    <>
      <Aurora />
      <div className="page">
        <header className="topbar">
          <Logo />
          <nav>
            <Link className="link" href="/rules">Rules &amp; odds</Link>
            <Link className="link" href="/staff/login">Staff portal</Link>
          </nav>
        </header>

        <main className="hero">
          <section>
            <motion.span className="eyebrow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><Sparkles size={14} /> A thank-you from VTH</motion.span>
            <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.7 }}>
              Spin the wheel.<br /><span className="gold-text">Claim your reward.</span>
            </motion.h1>
            <motion.p className="lede" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.7 }}>
              Thank you for being a valued VTH client. Enter the one-time code from your conversation with us to unlock a single spin — every section on the wheel is a prize.
            </motion.p>

            <motion.div className="glass panel" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.7 }}>
              <AnimatePresence mode="wait" initial={false}>
                {(phase === "enter" || phase === "checking") && (
                  <motion.form key="form" onSubmit={unlock} exit={{ opacity: 0, y: -10 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} noValidate>
                    <div className="field">
                      <label htmlFor="code">Your one-time spin code</label>
                      <motion.div animate={shakeCtl} className={`codebox ${err && err.kind !== "limit" ? "err" : ""}`}>
                        <span className="lead"><KeyRound size={20} /></span>
                        <input id="code" className="input" placeholder="VTH-XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} inputMode="text"
                          value={value} disabled={phase === "checking"} onChange={(e) => { setValue(e.target.value); if (err) setErr(null); }}
                          onPaste={(e) => { e.preventDefault(); const t = e.clipboardData.getData("text"); setValue(formatCode(t.trim())); setErr(null); }} aria-invalid={!!err} />
                      </motion.div>
                    </div>

                    <AnimatePresence>{err && <ErrorBox key={err.kind} err={err} cool={cool} />}</AnimatePresence>

                    <button className="btn btn-gold btn-lg shine" style={{ width: "100%", marginTop: 18 }} disabled={phase === "checking" || cool > 0}>
                      {phase === "checking" ? (<><span className="spinner" style={{ borderTopColor: "#2a1a00", borderColor: "rgba(42,26,0,.25)" }} /> Checking your code…</>) : cool > 0 ? (<><Timer size={18} /> Try again in {cool}s</>) : (<>Unlock My Spin <ArrowRight size={18} /></>)}
                    </button>
                    <div className="notice"><Info size={15} /><span><b style={{ color: "var(--text)" }}>One spin per code.</b> Once your wheel stops, your reward is recorded straight away and the code can’t be used again.</span></div>
                    <div className="trust"><span><ShieldCheck size={14} /> Protected by bot verification</span><span><Lock size={14} /> Secure &amp; private</span></div>
                  </motion.form>
                )}

                {phase === "ready" && (
                  <motion.div key="ready" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 24 }}>
                    <div className="verified">
                      <motion.div className="tick" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.1 }}><Check size={26} strokeWidth={3} /></motion.div>
                      <div>
                        <div style={{ color: "var(--teal)", fontSize: 12.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" }}>Code verified</div>
                        <h3 style={{ fontSize: 24, marginTop: 2 }}>Welcome, {first}!</h3>
                      </div>
                    </div>
                    <p style={{ color: "var(--muted)", margin: "14px 0 20px" }}>Your wheel is unlocked. Press the glowing <b style={{ color: "var(--gold-2)" }}>SPIN</b> button in the centre — good luck!</p>
                    <button className="btn btn-gold btn-lg shine" style={{ width: "100%" }} onClick={spin}><Gift size={20} /> Spin the Wheel</button>
                    <div className="notice"><Info size={15} /><span>This is your one and only spin for code <b className="mono" style={{ color: "var(--text)" }}>{active?.code}</b>.</span></div>
                  </motion.div>
                )}

                {phase === "spinning" && (
                  <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ textAlign: "center", padding: "16px 0" }}>
                    <h3 style={{ fontSize: 26 }}>Spinning…</h3>
                    <p style={{ color: "var(--muted)", marginTop: 6 }}>Fingers crossed, {first}.</p>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 18 }}>
                      {[0, 1, 2].map((i) => <motion.span key={i} style={{ width: 10, height: 10, borderRadius: 99, background: "var(--gold)" }} animate={{ y: [0, -10, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />)}
                    </div>
                  </motion.div>
                )}

                {phase === "done" && result && (
                  <motion.div key="done" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="verified">
                      <div className="tick" style={{ color: "var(--gold)", borderColor: "rgba(245,196,81,.5)", background: "rgba(245,196,81,.1)" }}><Trophy size={24} /></div>
                      <div>
                        <div style={{ color: "var(--gold)", fontSize: 12.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" }}>{restored ? "Welcome back" : "Reward recorded"}</div>
                        <h3 style={{ fontSize: 22, marginTop: 2 }}>{result.reward.name}</h3>
                      </div>
                    </div>
                    <p style={{ color: "var(--muted)", margin: "12px 0 18px", fontSize: 14 }}>Reference <b className="mono" style={{ color: "var(--gold-2)" }}>{result.ref}</b> — we’ve emailed the details and your VTH contact will be in touch.</p>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button className="btn btn-primary" onClick={() => setShowReveal(true)}>View my reward</button>
                      <button className="btn btn-ghost" onClick={reset}>Use another code</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <div className="steps">
              <div><b>1</b> Get a code on your call</div>
              <div><b>2</b> Enter it &amp; spin</div>
              <div><b>3</b> Reward is recorded instantly</div>
            </div>
          </section>

          <motion.section ref={stage} className="stage" initial={{ opacity: 0, scale: 0.85, rotate: -12 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ delay: 0.15, duration: 1, type: "spring", damping: 18, stiffness: 70 }}>
            <Wheel ref={wheel} rewards={storeReady ? rewards : rewards} locked={locked} ready={phase === "ready"} spinning={phase === "spinning"} winnerIndex={winner} onSpin={spin} />
            <p className="fixed-note">{locked ? "Enter your code to unlock the wheel" : phase === "ready" ? "12 equal sections — every spin wins" : "Your result is decided and recorded before the wheel moves"}</p>
          </motion.section>
        </main>
      </div>

      <Confetti fire={showReveal && !restored} />
      <AnimatePresence>
        {showReveal && result && (
          <Reveal key="reveal" result={result} name={active?.name ?? ""} email={active?.email} restored={restored} onClose={() => setShowReveal(false)} toast={toast} />
        )}
      </AnimatePresence>
    </>
  );
}

function ErrorBox({ err, cool }: { err: NonNullable<Err>; cool: number }) {
  const map = {
    empty: { t: "Please enter your code", m: "Paste or type the code you received from your VTH contact.", i: <AlertTriangle size={20} />, w: true },
    invalid: { t: "We couldn’t find that code", m: "Check for typos, or ask your VTH contact to confirm the code.", i: <XCircle size={20} /> },
    used: { t: "This code has already been used", m: "Each code gives one spin. If you think this is a mistake, contact your VTH representative.", i: <XCircle size={20} /> },
    expired: { t: "This code has expired", m: err.code ? `It expired on ${fmtDate(err.code.expiresAt)}. Ask your VTH contact to issue a new one straight away.` : "Ask your VTH contact to issue a new one.", i: <CalendarX size={20} />, w: true },
    cancelled: { t: "This code is no longer active", m: "It has been cancelled. Please contact your VTH representative.", i: <XCircle size={20} /> },
    limit: { t: "Too many attempts", m: `For security, please wait ${cool || 30} seconds before trying again.`, i: <Timer size={20} />, w: true },
  }[err.kind];
  return (
    <motion.div className={`errbox ${map.w ? "warn" : ""}`} role="alert" initial={{ opacity: 0, height: 0, y: -6 }} animate={{ opacity: 1, height: "auto", y: 0 }} exit={{ opacity: 0, height: 0 }}>
      {map.i}<div><b>{map.t}</b>{map.m}</div>
    </motion.div>
  );
}

function Reveal({ result, name, email, restored, onClose, toast }: { result: { reward: Reward; ref: string }; name: string; email?: string; restored: boolean; onClose: () => void; toast: (m: string) => void }) {
  const Icon = ICONS[result.reward.icon];
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(result.ref); } catch {} setCopied(true); toast("Reference copied"); setTimeout(() => setCopied(false), 2000); };
  return (
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="reveal" role="dialog" aria-modal="true" aria-label="Your reward" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.7, y: 60 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} transition={{ type: "spring", stiffness: 220, damping: 20 }}>
        <motion.div className="medal" initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.2 }}><Icon size={46} strokeWidth={1.8} /></motion.div>
        <motion.h2 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>{restored ? "Welcome back — here’s your result" : `Congratulations, ${name.split(" ")[0]}!`}</motion.h2>
        <motion.div className="prize gold-text" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>{result.reward.name}</motion.div>
        <motion.p className="d" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}>{result.reward.desc}</motion.p>
        <motion.div className="refbox" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
          <div><small>Your reference number</small><b>{result.ref}</b></div>
          <button className="btn btn-ghost btn-sm" onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy"}</button>
        </motion.div>
        <motion.div className="recorded" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.95 }}><CheckCircle2 size={17} /> Your reward has been recorded</motion.div>
        <motion.div className="next-list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05 }}>
          <div><Mail size={16} /><span>A confirmation email {email ? <>is on its way to <b style={{ color: "var(--text)" }}>{email}</b></> : "will be sent"} with your claiming instructions.</span></div>
          <div><Gift size={16} /><span>Quote your reference number when you get in touch with VTH.</span></div>
        </motion.div>
        <button className="btn btn-primary" style={{ marginTop: 24, width: "100%" }} onClick={onClose}>Done</button>
      </motion.div>
    </motion.div>
  );
}
