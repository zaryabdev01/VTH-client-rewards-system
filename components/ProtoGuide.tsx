"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Compass, X, ExternalLink, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { useToast } from "./Toast";

const DEMO = [
  { code: "VTH-7K2M-9QXA", note: "Valid – opens the wheel" },
  { code: "VTH-EXPD-4821", note: "Expired code state" },
  { code: "VTH-USED-0000", note: "Already used state" },
  { code: "VTH-FAKE-0000", note: "Invalid code state" },
];

export default function ProtoGuide() {
  const [open, setOpen] = useState(false);
  const { resetDemo } = useStore();
  const toast = useToast();
  const copy = async (c: string) => { try { await navigator.clipboard.writeText(c); } catch {} toast(`Copied ${c}`); };
  return (
    <>
      <button className="guide-fab" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? <X size={16} /> : <Compass size={16} />} Prototype guide
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="glass guide" initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.97 }} transition={{ type: "spring", stiffness: 380, damping: 30 }}>
            <h4>Client review guide</h4>
            <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>Clickable design prototype – all data is sample content.</p>
            <div className="sec">Customer journey</div>
            <Link href="/" onClick={() => setOpen(false)}>Landing &amp; wheel <ExternalLink size={13} /></Link>
            <Link href="/rules" onClick={() => setOpen(false)}>Rules &amp; probabilities <ExternalLink size={13} /></Link>
            <div className="sec">Try a demo code (click to copy)</div>
            {DEMO.map((d) => (
              <button key={d.code} className="code-row" onClick={() => copy(d.code)}>
                <span><span className="mono">{d.code}</span><small>{d.note}</small></span>
              </button>
            ))}
            <div className="sec">Staff portal</div>
            <Link href="/staff/login" onClick={() => setOpen(false)}>Login <ExternalLink size={13} /></Link>
            <Link href="/staff" onClick={() => setOpen(false)}>Dashboard <ExternalLink size={13} /></Link>
            <Link href="/staff/codes" onClick={() => setOpen(false)}>Codes &amp; history <ExternalLink size={13} /></Link>
            <Link href="/staff/rewards" onClick={() => setOpen(false)}>Reward settings <ExternalLink size={13} /></Link>
            <Link href="/staff/emails" onClick={() => setOpen(false)}>Email templates <ExternalLink size={13} /></Link>
            <Link href="/staff/activity" onClick={() => setOpen(false)}>Activity log <ExternalLink size={13} /></Link>
            <Link href="/staff/team" onClick={() => setOpen(false)}>Team &amp; settings <ExternalLink size={13} /></Link>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 16, width: "100%" }} onClick={() => { resetDemo(); toast("Demo data reset"); }}>
              <RotateCcw size={14} /> Reset demo data
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
