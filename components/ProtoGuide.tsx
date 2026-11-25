"use client";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "./Toast";

/** Review helper for the demo/staging deployment only (NEXT_PUBLIC_DEMO=1). Never shown in production. */
const DEMO = [
  { code: "VTH-DEMO-VALD-2026", note: "Valid — opens the wheel (one spin; re-seed to reuse)" },
  { code: "VTH-DEMO-EXPD-2026", note: "Expired code state" },
  { code: "VTH-DEMO-USED-2026", note: "Already-used state" },
  { code: "VTH-FAKE-0000-0000", note: "Invalid code state" },
];

export default function ProtoGuide() {
  // Staging/demo only. In production NEXT_PUBLIC_DEMO is unset, so this renders nothing.
  if (process.env.NEXT_PUBLIC_DEMO !== "1") return null;
  return <Guide />;
}

function Guide() {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const copy = async (c: string) => { try { await navigator.clipboard.writeText(c); } catch {} toast(`Copied ${c}`); };
  const close = () => setOpen(false);
  return (
    <>
      <button className="guide-fab" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? <X size={16} /> : <BookOpen size={16} />} Review guide
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="glass guide" initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.97 }} transition={{ type: "spring", stiffness: 380, damping: 30 }}>
            <h4>Client review guide</h4>
            <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>Staging environment — sample data only.</p>
            <div className="sec">Customer journey</div>
            <Link href="/" onClick={close}>Landing &amp; wheel <ExternalLink size={13} /></Link>
            <Link href="/rules" onClick={close}>Rules &amp; probabilities <ExternalLink size={13} /></Link>
            <div className="sec">Demo codes (click to copy)</div>
            {DEMO.map((d) => (
              <button key={d.code} className="code-row" onClick={() => copy(d.code)}>
                <span><span className="mono">{d.code}</span><small>{d.note}</small></span>
              </button>
            ))}
            <div className="sec">Staff portal</div>
            <Link href="/staff/login" onClick={close}>Login <ExternalLink size={13} /></Link>
            <Link href="/staff" onClick={close}>Dashboard <ExternalLink size={13} /></Link>
            <Link href="/staff/codes" onClick={close}>Codes &amp; history <ExternalLink size={13} /></Link>
            <Link href="/staff/recurring" onClick={close}>Recurring spins <ExternalLink size={13} /></Link>
            <Link href="/staff/rewards" onClick={close}>Reward settings <ExternalLink size={13} /></Link>
            <Link href="/staff/emails" onClick={close}>Email templates <ExternalLink size={13} /></Link>
            <Link href="/staff/activity" onClick={close}>Activity log <ExternalLink size={13} /></Link>
            <Link href="/staff/team" onClick={close}>Team &amp; settings <ExternalLink size={13} /></Link>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
