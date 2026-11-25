"use client";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { AlertTriangle, ArrowRight, CalendarX, Check, CheckCircle2, Copy, Gift, Info, KeyRound, Lock, Mail, ShieldCheck, Sparkles, Timer, XCircle, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Aurora, Logo } from "@/components/Brand";
import Confetti from "@/components/Confetti";
import Wheel, { ICONS, type WheelHandle } from "@/components/Wheel";
import PrizeModal from "@/components/PrizeModal";
import { useToast } from "@/components/Toast";
import Turnstile, { type TurnstileHandle } from "@/components/Turnstile";
import { ApiErr, api } from "@/lib/api";
import { errMsg } from "@/lib/store";
import { DEFAULT_REWARDS, fmtDate, formatCode, normaliseCode, type Reward } from "@/lib/shared";

type Phase = "enter" | "checking" | "ready" | "spinning" | "done";
type Err = { kind: "invalid" | "used" | "expired" | "cancelled" | "empty" | "limit" | "bot" | "network"; expiresAt?: string } | null;
type Active = { firstName: string; code: string; pass: string; spins: number };
type Result = { reward: Reward; ref: string; firstName: string; maskedEmail: string | null; final: boolean; canRespin: boolean; spinsAllowed: number; spinsUsed: number };
type CheckRes = ({ ok: true; restored: true; firstName: string; reward: Reward; ref: string; maskedEmail: string | null; final: boolean; canRespin: boolean; spinsAllowed: number; spinsUsed: number }) | { ok: true; restored: false; firstName: string; pass: string; spins: number } | { ok: false; reason: "invalid" | "used" | "expired" | "cancelled"; expiresAt?: string };
type SpinRes = { ok: true; restored: boolean; reward: Reward; ref: string; firstName: string; maskedEmail: string | null; final: boolean; canRespin: boolean; spinsAllowed: number; spinsUsed: number };
const toResult = (r: Omit<SpinRes, "ok" | "restored">): Result => ({ reward: r.reward, ref: r.ref, firstName: r.firstName, maskedEmail: r.maskedEmail, final: r.final, canRespin: r.canRespin, spinsAllowed: r.spinsAllowed, spinsUsed: r.spinsUsed });

// The claim secret lives in THIS browser only. It is created before the spin request so that even if the response is lost
// (connection drop, closed tab) the same browser can ask the server for its original result.
const claimKey = (code: string) => `vth-claim-${normaliseCode(code)}`;
const getClaim = (code: string) => { try { return localStorage.getItem(claimKey(code)) ?? undefined; } catch { return undefined; } };
const newClaim = (code: string) => {
  const b = crypto.getRandomValues(new Uint8Array(24));
  const t = btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  try { localStorage.setItem(claimKey(code), t); } catch {}
  return t;
};

export default function Home() {
  const toast = useToast();
  const wheel = useRef<WheelHandle>(null);
  const stage = useRef<HTMLElement>(null);
  const ts = useRef<TurnstileHandle>(null);
  const [rewards, setRewards] = useState<Reward[]>(DEFAULT_REWARDS);
  const [tsKey, setTsKey] = useState<string | null>(null);
  const [tsToken, setTsToken] = useState("");
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<Phase>("enter");
  const [err, setErr] = useState<Err>(null);
  const shakeCtl = useAnimationControls();
  const [cool, setCool] = useState(0);
  const [active, setActive] = useState<Active | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const [restored, setRestored] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const [peek, setPeek] = useState<Reward | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    api.get<{ rewards: Reward[]; turnstile: string | null }>("/api/public/wheel").then((d) => { setRewards(d.rewards); setTsKey(d.turnstile); }).catch(() => {});
    const qs = new URLSearchParams(window.location.search);
    const q = qs.get("code"); // links in emails pre-fill the code
    if (q) setValue(formatCode(q.trim()));
    // Embed mode (?embed=1): hide the site header and tell the parent page how tall we are so its iframe can auto-resize.
    if (qs.get("embed") === "1" && window.parent !== window) {
      document.documentElement.classList.add("embed");
      const post = () => window.parent.postMessage({ type: "vth-spin-height", height: document.documentElement.scrollHeight }, "*");
      const ro = new ResizeObserver(post); ro.observe(document.body); post();
      return () => ro.disconnect();
    }
  }, []);
  useEffect(() => { if (cool > 0) { const t = setTimeout(() => setCool(cool - 1), 1000); return () => clearTimeout(t); } }, [cool]);

  const fail = (e: Err) => { setErr(e); shakeCtl.start({ x: [0, -9, 9, -7, 7, -3, 0], transition: { duration: 0.45 } }); setPhase("enter"); ts.current?.reset(); };
  const showResult = (r: Result, isRestore: boolean) => {
    setResult(r); setRestored(isRestore);
    setWinner(rewards.findIndex((x) => x.id === r.reward.id)); setPhase("done"); setShowReveal(true);
  };

  const unlock = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (cool > 0) return;
    if (!value.trim()) return fail({ kind: "empty" });
    if (tsKey && !tsToken) return fail({ kind: "bot" });
    setErr(null); setPhase("checking");
    try {
      const [r] = await Promise.all([api.post<CheckRes>("/api/redeem/check", { code: value, claimToken: getClaim(value), turnstile: tsToken || undefined }), new Promise((x) => setTimeout(x, 700))]);
      if (!r.ok) return fail({ kind: r.reason, expiresAt: r.expiresAt });
      if (r.restored) { setActive({ firstName: r.firstName, code: formatCode(value), pass: "", spins: r.spinsAllowed }); return showResult(toResult(r), true); }
      setTsToken(""); // a Turnstile token is single-use; the widget issues a fresh one if the form comes back
      setActive({ firstName: r.firstName, code: formatCode(value), pass: r.pass, spins: r.spins }); setPhase("ready");
    } catch (e) {
      if (e instanceof ApiErr && e.status === 429) { setCool(Number(e.data.retryAfter) || 30); return fail({ kind: "limit" }); }
      if (e instanceof ApiErr && e.data.reason === "bot") return fail({ kind: "bot" });
      fail({ kind: "network" });
    }
  };

  /** respin=true: the holder of a 2-spin code uses their second spin, which voids the first prize. */
  const spin = async (respin = false) => {
    if (!active || (!respin && phase !== "ready")) return;
    setShowReveal(false); setPhase("spinning");
    if (window.innerWidth < 960) stage.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const claimToken = respin ? getClaim(active.code) ?? newClaim(active.code) : newClaim(active.code);
    let r: SpinRes | null = null;
    try {
      // The server picks + records the prize atomically; the wheel only animates to the result it returns.
      r = await api.post<SpinRes>("/api/redeem/spin", { code: active.code, pass: active.pass, claimToken, respin: respin || undefined });
    } catch (e) {
      if (e instanceof ApiErr && e.data.network) {
        // Response may have been lost AFTER the server recorded the win: recover our current result.
        try { const c = await api.post<CheckRes>("/api/redeem/check", { code: active.code, claimToken }); if (c.ok && c.restored) r = { ...c, ok: true }; } catch {}
      }
      if (!r) {
        if (!respin) { try { localStorage.removeItem(claimKey(active.code)); } catch {} setActive(null); }
        else setPhase("done"); // keep the first prize on screen; nothing was changed
        return fail(e instanceof ApiErr && e.data.reason && ["used", "expired", "cancelled", "invalid"].includes(e.data.reason) ? { kind: e.data.reason } : { kind: "network" });
      }
    }
    const res = toResult(r);
    const idx = rewards.findIndex((x) => x.id === res.reward.id);
    setResult(res); setRestored(false); setWinner(null);
    await wheel.current?.spinTo(idx);
    setWinner(idx); setPhase("done");
    setTimeout(() => setShowReveal(true), 650);
  };

  const accept = async () => {
    if (!active && !value) return;
    const code = active?.code ?? formatCode(value);
    const claimToken = getClaim(code);
    if (!claimToken) return toast("We couldn't confirm this browser holds the spin. Contact your VTH representative.", "error");
    setAccepting(true);
    try {
      const r = await api.post<SpinRes>("/api/redeem/accept", { code, claimToken });
      setResult(toResult(r)); toast("Prize accepted. VTH has been notified");
    } catch (e) { toast(errMsg(e), "error"); }
    setAccepting(false);
  };

  const reset = () => { setTsToken(""); setPhase("enter"); setValue(""); setErr(null); setActive(null); setResult(null); setWinner(null); setShowReveal(false); setRestored(false); };
  const first = active?.firstName;
  const locked = phase === "enter" || phase === "checking";

  return (
    <>
      <Aurora />
      <div className="page">
        <header className="topbar">
          <Logo />
          <nav>
            <Link className="link" href="/rules">Prizes &amp; odds</Link>
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
              Thank you for being a valued VTH client. Enter the one-time code from your conversation with us to unlock your spin. Every section on the wheel is a prize, and you can tap any prize to see what it includes.
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

                    {tsKey && <div style={{ marginTop: 14 }}><Turnstile ref={ts} siteKey={tsKey} onToken={setTsToken} /></div>}
                    <button className="btn btn-gold btn-lg shine" style={{ width: "100%", marginTop: 18 }} disabled={phase === "checking" || cool > 0}>
                      {phase === "checking" ? (<><span className="spinner" style={{ borderTopColor: "#2a1a00", borderColor: "rgba(42,26,0,.25)" }} /> Checking your code…</>) : cool > 0 ? (<><Timer size={18} /> Try again in {cool}s</>) : (<>Unlock My Spin <ArrowRight size={18} /></>)}
                    </button>
                    <div className="notice"><Info size={15} /><span><b style={{ color: "var(--text)" }}>One-time code.</b> Most codes give one spin and your reward is recorded as soon as the wheel stops. Some codes give two spins: a second spin replaces your first prize, so you choose which to accept.</span></div>
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
                    <button className="btn btn-gold btn-lg shine" style={{ width: "100%" }} onClick={() => spin()}><Gift size={20} /> Spin the Wheel</button>
                    <div className="notice"><Info size={15} /><span>{(active?.spins ?? 1) > 1 ? <>This code gives you <b style={{ color: "var(--text)" }}>two spins</b>. After the first, you can accept your prize or spin again (the second prize replaces the first).</> : <>This is your one and only spin for code <b className="mono" style={{ color: "var(--text)" }}>{active?.code}</b>.</>}</span></div>
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
                      <div className="tick" style={{ color: "var(--gold)", borderColor: "rgba(255,185,0,.5)", background: "rgba(255,185,0,.1)" }}><Trophy size={24} /></div>
                      <div>
                        <div style={{ color: "var(--gold)", fontSize: 12.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" }}>{result.final ? (restored ? "Welcome back" : "Reward recorded") : "Prize won, awaiting your decision"}</div>
                        <h3 style={{ fontSize: 22, marginTop: 2 }}>{result.reward.name}</h3>
                      </div>
                    </div>
                    {result.final ? (
                      <p style={{ color: "var(--muted)", margin: "12px 0 18px", fontSize: 14 }}>Reference <b className="mono" style={{ color: "var(--gold-2)" }}>{result.ref}</b>. We’ve emailed the details and your VTH contact will be in touch.</p>
                    ) : (
                      <p style={{ color: "var(--muted)", margin: "12px 0 18px", fontSize: 14 }}>{result.canRespin ? "Happy with this? Accept it and VTH will arrange it. Or use your second spin: it replaces this prize." : "Accept this prize and VTH will arrange it."}</p>
                    )}
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {!result.final && <button className="btn btn-gold" onClick={accept} disabled={accepting}>{accepting ? <span className="spinner" /> : <><Check size={16} /> Accept this prize</>}</button>}
                      {!result.final && result.canRespin && <button className="btn btn-primary" onClick={() => spin(true)}>Use my second spin</button>}
                      <button className="btn btn-ghost" onClick={() => setShowReveal(true)}>View details</button>
                      {result.final && <button className="btn btn-ghost" onClick={reset}>Use another code</button>}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <div className="steps">
              <div><b>1</b> Get a code on your call</div>
              <div><b>2</b> Enter it &amp; spin</div>
              <div><b>3</b> Accept your prize</div>
            </div>
          </section>

          <motion.section ref={stage} className="stage" initial={{ opacity: 0, scale: 0.85, rotate: -12 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ delay: 0.15, duration: 1, type: "spring", damping: 18, stiffness: 70 }}>
            <Wheel ref={wheel} rewards={rewards} locked={locked} ready={phase === "ready"} spinning={phase === "spinning"} winnerIndex={winner} onSpin={() => spin()} onSelect={(i) => setPeek(rewards[i])} />
            <p className="fixed-note">{locked ? "Tap any section to see the prize. Enter your code to unlock the wheel" : phase === "ready" ? "12 equal sections: every spin wins" : "Your result is decided and recorded before the wheel moves"}</p>
          </motion.section>
        </main>
      </div>

      <Confetti fire={showReveal && !restored} />
      <AnimatePresence>
        {showReveal && result && (
          <Reveal key="reveal" result={result} restored={restored} onClose={() => setShowReveal(false)} toast={toast} onAccept={accept} accepting={accepting} onRespin={() => spin(true)} />
        )}
      </AnimatePresence>
      <AnimatePresence>{peek && <PrizeModal key={`p${peek.id}`} reward={peek} onClose={() => setPeek(null)} />}</AnimatePresence>
      <footer className="sitefoot no-print">
        <span>© Vocational Training Hub</span>
        <Link href="/legal/terms">Terms &amp; Conditions</Link><Link href="/legal/privacy">Privacy Notice</Link><Link href="/legal/prize-rules">Prize Rules</Link>
      </footer>
    </>
  );
}

function ErrorBox({ err, cool }: { err: NonNullable<Err>; cool: number }) {
  const map = {
    empty: { t: "Please enter your code", m: "Paste or type the code you received from your VTH contact.", i: <AlertTriangle size={20} />, w: true },
    invalid: { t: "We couldn’t find that code", m: "Check for typos, or ask your VTH contact to confirm the code.", i: <XCircle size={20} /> },
    used: { t: "This code has already been used", m: "Each code gives one spin. If you think this is a mistake, contact your VTH representative.", i: <XCircle size={20} /> },
    expired: { t: "This code has expired", m: err.expiresAt ? `It expired on ${fmtDate(err.expiresAt)}. Ask your VTH contact to issue a new one straight away.` : "Ask your VTH contact to issue a new one.", i: <CalendarX size={20} />, w: true },
    cancelled: { t: "This code is no longer active", m: "It has been cancelled. Please contact your VTH representative.", i: <XCircle size={20} /> },
    bot: { t: "Please complete the security check", m: "Tick the box above to confirm you’re human, then try again.", i: <ShieldCheck size={20} />, w: true },
    network: { t: "We couldn’t reach the server", m: "Check your connection and try again. If you already spun, re-enter your code and we’ll restore your result.", i: <AlertTriangle size={20} />, w: true },
    limit: { t: "Too many attempts", m: `For security, please wait ${cool || 30} seconds before trying again.`, i: <Timer size={20} />, w: true },
  }[err.kind];
  return (
    <motion.div className={`errbox ${map.w ? "warn" : ""}`} role="alert" initial={{ opacity: 0, height: 0, y: -6 }} animate={{ opacity: 1, height: "auto", y: 0 }} exit={{ opacity: 0, height: 0 }}>
      {map.i}<div><b>{map.t}</b>{map.m}</div>
    </motion.div>
  );
}

function Reveal({ result, restored, onClose, toast, onAccept, accepting, onRespin }: { result: Result; restored: boolean; onClose: () => void; toast: (m: string) => void; onAccept: () => void; accepting: boolean; onRespin: () => void }) {
  const Icon = ICONS[result.reward.icon];
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(result.ref); } catch {} setCopied(true); toast("Reference copied"); setTimeout(() => setCopied(false), 2000); };
  return (
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="reveal" role="dialog" aria-modal="true" aria-label="Your reward" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.7, y: 60 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} transition={{ type: "spring", stiffness: 220, damping: 20 }}>
        <motion.div className="medal" initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.2 }}><Icon size={46} strokeWidth={1.8} /></motion.div>
        <motion.h2 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>{restored ? "Welcome back, here’s your result" : `Congratulations, ${result.firstName}!`}</motion.h2>
        <motion.div className="prize gold-text" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>{result.reward.name}</motion.div>
        <motion.p className="d" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}>{result.reward.desc}</motion.p>
        <motion.div className="refbox" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
          <div><small>Your reference number</small><b>{result.ref}</b></div>
          <button className="btn btn-ghost btn-sm" onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy"}</button>
        </motion.div>
        {result.final ? (
          <>
            <motion.div className="recorded" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.95 }}><CheckCircle2 size={17} /> Your reward has been recorded</motion.div>
            <motion.div className="next-list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05 }}>
              <div><Mail size={16} /><span>A confirmation email {result.maskedEmail ? <>is on its way to <b style={{ color: "var(--text)" }}>{result.maskedEmail}</b></> : "will be sent"} with your claiming instructions.</span></div>
              <div><Gift size={16} /><span>Quote your reference number when you get in touch with VTH.</span></div>
            </motion.div>
            <button className="btn btn-primary" style={{ marginTop: 24, width: "100%" }} onClick={onClose}>Done</button>
          </>
        ) : (
          <>
            <motion.div className="next-list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }}>
              <div><Gift size={16} /><span><b style={{ color: "var(--text)" }}>Accept</b> to confirm this prize. VTH is notified and will be in touch to arrange it.</span></div>
              {result.canRespin && <div><Sparkles size={16} /><span><b style={{ color: "var(--text)" }}>Spin again</b> to use your second spin. That replaces this prize, and your second prize is final.</span></div>}
            </motion.div>
            <div style={{ display: "grid", gap: 10, marginTop: 22 }}>
              <button className="btn btn-gold btn-lg" onClick={() => { onAccept(); onClose(); }} disabled={accepting}><Check size={18} /> Accept this prize</button>
              {result.canRespin && <button className="btn btn-ghost" onClick={onRespin}>Spin again (replaces this prize)</button>}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
