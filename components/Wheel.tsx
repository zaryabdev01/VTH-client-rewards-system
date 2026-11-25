"use client";
import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { Coins, User, Percent, Zap, Gem, ArrowUpCircle, Users, Sparkles, Video, Award, Crown, Armchair, Lock, type LucideIcon } from "lucide-react";
import type { IconKey, Reward } from "@/lib/shared";

export const ICONS: Record<IconKey, LucideIcon> = {
  coins: Coins, user: User, percent: Percent, zap: Zap, gem: Gem, arrowUp: ArrowUpCircle,
  users: Users, sparkles: Sparkles, video: Video, award: Award, crown: Crown, armchair: Armchair,
};

// alternating deep tones with a gold hairline — all sections equal
const FILLS = [
  ["#2a3cd6", "#192AC1"], ["#1D2C92", "#161f86"],
];
const C = 200, R = 178;
const polar = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  // rounded so server-rendered and client-computed SVG are byte-identical (avoids hydration mismatches)
  const q = (v: number) => Math.round(v * 1000) / 1000;
  return [q(C + r * Math.cos(a)), q(C + r * Math.sin(a))];
};
const slice = (i: number) => {
  const [x1, y1] = polar(R, i * 30 - 15);
  const [x2, y2] = polar(R, i * 30 + 15);
  return `M${C},${C} L${x1},${y1} A${R},${R} 0 0 1 ${x2},${y2} Z`;
};

export type WheelHandle = { spinTo: (index: number) => Promise<void>; pointTo: (index: number) => void };
type Props = { rewards: Reward[]; locked: boolean; ready: boolean; spinning: boolean; winnerIndex?: number | null; onSpin: () => void; onSelect?: (index: number) => void };

const Wheel = forwardRef<WheelHandle, Props>(function Wheel({ rewards, locked, ready, spinning, winnerIndex, onSpin, onSelect }, ref) {
  const reduce = useReducedMotion();
  const rot = useMotionValue(0);
  const pointer = useMotionValue(0);
  const last = useRef(0);

  // idle drift while locked or ready
  useEffect(() => {
    if (spinning || reduce || winnerIndex != null) return;
    const speed = locked ? 0.012 : 0.022;
    let raf = 0, prev = performance.now();
    const tick = (t: number) => { rot.set(rot.get() + (t - prev) * speed); prev = t; raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spinning, locked, reduce, winnerIndex, rot]);

  // pointer tick whenever a section boundary passes
  useEffect(() => {
    return rot.on("change", (v) => {
      const seg = Math.floor((v + 15) / 30);
      if (seg !== last.current) {
        last.current = seg;
        if (spinning) animate(pointer, [-16, 0], { duration: 0.12, ease: "easeOut" });
      }
    });
  }, [rot, pointer, spinning]);

  useImperativeHandle(ref, () => ({
    pointTo: (index: number) => {
      const current = rot.get();
      const want = (360 - index * 30) % 360;
      const delta = ((((want - (current % 360)) % 360) + 540) % 360) - 180;
      animate(rot, current + delta, { duration: reduce ? 0.01 : 0.8, ease: [0.22, 1, 0.36, 1] });
    },
    spinTo: (index: number) => {
      const current = rot.get();
      const jitter = (Math.random() - 0.5) * 16; // lands naturally inside the section
      const want = (((360 - index * 30 + jitter) % 360) + 360) % 360;
      const delta = ((want - (current % 360)) + 360) % 360;
      const target = current + 360 * 6 + delta;
      return new Promise<void>((resolve) => {
        if (reduce) {
          animate(rot, target, { duration: 0.01 }); setTimeout(resolve, 1200); return;
        }
        animate(rot, target, { duration: 6.2, ease: [0.12, 0.62, 0.08, 1], onComplete: () => resolve() });
      });
    },
  }));

  return (
    <div className={`wheel-wrap ${locked ? "is-locked" : ""} ${spinning ? "is-spinning" : ""}`}>
      <div className="wheel-glow" />
      {/* fixed pointer */}
      <motion.div className="wheel-pointer" style={{ rotate: pointer, transformOrigin: "50% 28%" }} aria-hidden>
        <svg viewBox="0 0 60 78" width="100%" height="100%">
          <defs>
            <linearGradient id="pg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#FFD35C" /><stop offset="1" stopColor="#b99b5c" /></linearGradient>
            <filter id="ps" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity=".5" /></filter>
          </defs>
          <path d="M30 76 C30 76 6 46 6 28 A24 24 0 1 1 54 28 C54 46 30 76 30 76Z" fill="#0d0d10" stroke="#FFB900" strokeWidth="1.6" filter="url(#ps)" />
          <circle cx="30" cy="28" r="8" fill="none" stroke="#FFB900" strokeWidth="1" /><circle cx="30" cy="28" r="2.6" fill="#d9c697" />
        </svg>
      </motion.div>

      <motion.svg viewBox="0 0 400 400" className="wheel-svg" style={{ rotate: rot }} role="img" aria-label="Prize wheel with 12 equal sections">
        <defs>
          {FILLS.map(([a, b], i) => (
            <radialGradient key={i} id={`wf${i}`} cx="50%" cy="50%" r="55%" gradientUnits="userSpaceOnUse" fx="200" fy="200">
              <stop offset="0.15" stopColor={b} /><stop offset="1" stopColor={a} />
            </radialGradient>
          ))}
          <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e9dcb8" /><stop offset=".5" stopColor="#b79a5e" /><stop offset="1" stopColor="#6b5530" />
          </linearGradient>
        </defs>
        <circle cx={C} cy={C} r={197} fill="#0a0e2e" stroke="#FFB900" strokeOpacity=".6" strokeWidth="1" />
        <circle cx={C} cy={C} r={186} fill="#0a0e2e" stroke="#FFB900" strokeOpacity=".3" strokeWidth=".8" />
        {rewards.map((r, i) => {
          const Icon = ICONS[r.icon];
          const lines = r.label.split("|");
          const win = winnerIndex === i;
          return (
            <g key={r.id} opacity={winnerIndex != null && !win ? 0.45 : 1} className={onSelect ? "slice-hit" : undefined} style={{ transition: "opacity .6s", cursor: onSelect && !spinning ? "pointer" : undefined }}
              onClick={onSelect && !spinning ? () => onSelect(i) : undefined}>
              <path d={slice(i)} fill={`url(#wf${i % 2})`} stroke="#FFB900" strokeOpacity={0.35} strokeWidth={0.7} />
              <g transform={`rotate(${i * 30} ${C} ${C})`}>
                <Icon x={C - 11} y={C - R + 10} width={20} height={20} color="#FFB900" strokeWidth={1.4} />
                <text transform={`translate(${C} ${C - 140}) rotate(-90)`} textAnchor="end" className="wheel-text">
                  {lines.map((l, k) => (
                    <tspan key={k} x={0} dy={k === 0 ? (lines.length > 1 ? -2 : 4) : 14}>{l}</tspan>
                  ))}
                </text>
              </g>
            </g>
          );
        })}
        {/* rim studs */}
        {Array.from({ length: 60 }).map((_, i) => {
          const [x1, y1] = polar(189, i * 6); const [x2, y2] = polar(i % 5 === 0 ? 194 : 192, i * 6);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FFB900" strokeOpacity={i % 5 === 0 ? 0.6 : 0.3} strokeWidth={0.8} />;
        })}
        <circle cx={C} cy={C} r={46} fill="#0a0e2e" stroke="#FFB900" strokeOpacity=".6" strokeWidth={1} />
      </motion.svg>

      {/* hub (does not rotate) */}
      <button className={`wheel-hub ${ready ? "is-ready" : ""}`} onClick={onSpin} disabled={!ready || spinning} aria-label={ready ? "Spin the wheel" : "Locked – enter your code"}>
        {locked ? <Lock size={22} /> : <span>{spinning ? "…" : "SPIN"}</span>}
      </button>
    </div>
  );
});
export default Wheel;
