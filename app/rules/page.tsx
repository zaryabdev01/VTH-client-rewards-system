"use client";
import { motion } from "framer-motion";
import { ArrowLeft, Scale } from "lucide-react";
import Link from "next/link";
import { Aurora, Logo } from "@/components/Brand";
import { ICONS } from "@/components/Wheel";
import { useStore } from "@/lib/store";

export default function Rules() {
  const { rewards } = useStore();
  const live = rewards.filter((r) => r.enabled);
  const pct = live.length ? (100 / live.length).toFixed(2) : "0";
  return (
    <>
      <Aurora />
      <div className="page">
        <header className="topbar"><Logo /><nav><Link className="link" href="/"><ArrowLeft size={14} style={{ display: "inline", verticalAlign: -2 }} /> Back to the wheel</Link></nav></header>
        <main className="rules">
          <span className="eyebrow"><Scale size={14} /> Rules &amp; probabilities</span>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>Fair, simple and <span className="gold-text">transparent</span></motion.h1>
          <p style={{ color: "var(--muted)", maxWidth: 640, fontSize: 17 }}>
            Every code unlocks one spin. The wheel has {live.length} equal sections, and each one has the same chance of landing — <b style={{ color: "var(--gold-2)" }}>{pct}%</b>. This list updates automatically whenever VTH changes the rewards.
          </p>
          <div className="odds">
            {live.map((r, i) => {
              const I = ICONS[r.icon];
              return (
                <motion.div key={r.id} className="glass" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
                  <div className="rico" style={{ margin: 0, flex: "none" }}><I size={20} /></div>
                  <div><b style={{ fontSize: 14.5 }}>{r.name}</b></div>
                  <span className="pct">{pct}%</span>
                </motion.div>
              );
            })}
          </div>
          <div className="terms glass" style={{ padding: 28 }}>
            <h3 style={{ marginTop: 0 }}>How it works</h3>
            <p>The prize is selected securely on our servers at the moment your code is redeemed. The wheel only animates to that recorded result, so refreshing or reopening the page cannot change the outcome.</p>
            <h3>Terms</h3>
            <p>One spin per code. Codes are non-transferable and may expire. Rewards are fulfilled manually by VTH after the spin and have no cash alternative. Final promotion terms, privacy notice and data retention wording will be supplied by VTH.</p>
            <p style={{ fontSize: 13, color: "var(--dim)" }}>Prototype placeholder text — to be replaced with VTH’s approved wording.</p>
          </div>
        </main>
      </div>
    </>
  );
}
