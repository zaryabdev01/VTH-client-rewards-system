"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowLeft, Scale } from "lucide-react";
import Link from "next/link";
import { Aurora, Logo } from "@/components/Brand";
import PrizeModal from "@/components/PrizeModal";
import { ICONS } from "@/components/Wheel";
import { api } from "@/lib/api";
import { DEFAULT_REWARDS, type Reward } from "@/lib/shared";

export default function Rules() {
  const [live, setLive] = useState<Reward[]>(DEFAULT_REWARDS);
  const [open, setOpen] = useState<Reward | null>(null);
  useEffect(() => { api.get<{ rewards: Reward[] }>("/api/public/wheel").then((d) => setLive(d.rewards)).catch(() => {}); }, []);
  const pct = live.length ? (100 / live.length).toFixed(2) : "0";
  return (
    <>
      <Aurora />
      <div className="page">
        <header className="topbar"><Logo /><nav><Link className="link" href="/"><ArrowLeft size={14} style={{ display: "inline", verticalAlign: -2 }} /> Back to the wheel</Link></nav></header>
        <main className="rules">
          <span className="eyebrow"><Scale size={14} /> Prizes &amp; probabilities</span>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>Fair, simple and <span className="gold-text">transparent</span></motion.h1>
          <p style={{ color: "var(--muted)", maxWidth: 640, fontSize: 17 }}>
            Every code unlocks a spin. The wheel has {live.length} equal sections, and each one has the same chance of landing: <b style={{ color: "var(--gold-2)" }}>{pct}%</b>. Select a prize to see the details. This list updates automatically whenever VTH changes the rewards.
          </p>
          <div className="odds">
            {live.map((r, i) => {
              const I = ICONS[r.icon];
              return (
                <motion.button type="button" key={r.id} className="glass oddcard" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} onClick={() => setOpen(r)} aria-label={`View ${r.name}`}>
                  <span className="rico" style={{ margin: 0, flex: "none" }}><I size={20} /></span>
                  <span style={{ fontWeight: 600, fontSize: 14.5, textAlign: "left" }}>{r.name}</span>
                  <span className="pct">{pct}%</span>
                </motion.button>
              );
            })}
          </div>
          <div className="terms glass" style={{ padding: 28 }}>
            <h3 style={{ marginTop: 0 }}>How it works</h3>
            <p>The prize is selected securely on our servers at the moment your code is redeemed. The wheel only animates to that recorded result, so refreshing or reopening the page cannot change the outcome.</p>
            <p>Read the full <Link href="/legal/prize-rules" style={{ color: "var(--gold-2)", textDecoration: "underline" }}>Prize Rules</Link>, <Link href="/legal/terms" style={{ color: "var(--gold-2)", textDecoration: "underline" }}>Terms &amp; Conditions</Link> and <Link href="/legal/privacy" style={{ color: "var(--gold-2)", textDecoration: "underline" }}>Privacy Notice</Link>.</p>
          </div>
        </main>
      </div>
      <AnimatePresence>{open && <PrizeModal key={open.id} reward={open} onClose={() => setOpen(null)} />}</AnimatePresence>
    </>
  );
}
