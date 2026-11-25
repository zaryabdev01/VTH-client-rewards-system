"use client";
import { useEffect, useRef } from "react";

const COLORS = ["#FFD35C", "#FFB900", "#f3f1ec", "#a3acdd", "#9a7b3f"];

export default function Confetti({ fire }: { fire: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!fire) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cv = ref.current!; const ctx = cv.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize();
    type P = { x: number; y: number; vx: number; vy: number; s: number; r: number; vr: number; c: string; shape: number; life: number };
    const ps: P[] = [];
    const burst = (x: number, y: number, n: number, dir: number) => {
      for (let i = 0; i < n; i++) {
        const a = dir + (Math.random() - 0.5) * 1.2, sp = 7 + Math.random() * 11;
        ps.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, s: 6 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
          c: COLORS[(Math.random() * COLORS.length) | 0], shape: (Math.random() * 3) | 0, life: 1 });
      }
    };
    burst(innerWidth * 0.5, innerHeight * 0.55, 90, -Math.PI / 2);
    burst(0, innerHeight * 0.8, 50, -Math.PI / 3);
    burst(innerWidth, innerHeight * 0.8, 50, (-2 * Math.PI) / 3);
    const t2 = setTimeout(() => burst(innerWidth * 0.5, innerHeight * 0.4, 40, -Math.PI / 2), 650);
    let raf = 0;
    const loop = () => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of ps) {
        p.vy += 0.28; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= 0.0045;
        ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6)); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
        if (p.shape === 0) ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        else if (p.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, p.s / 3, 0, 7); ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo(0, -p.s / 2); ctx.lineTo(p.s / 2, p.s / 2); ctx.lineTo(-p.s / 2, p.s / 2); ctx.fill(); }
        ctx.restore();
      }
      for (let i = ps.length - 1; i >= 0; i--) if (ps[i].life <= 0 || ps[i].y > innerHeight + 40) ps.splice(i, 1);
      if (ps.length) raf = requestAnimationFrame(loop); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); clearTimeout(t2); ctx.clearRect(0, 0, innerWidth, innerHeight); };
  }, [fire]);
  return <canvas ref={ref} className="confetti" aria-hidden />;
}
