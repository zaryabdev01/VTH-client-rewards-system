"use client";
import Link from "next/link";

export function Logo({ size = 34, text = true, href = "/" }: { size?: number; text?: boolean; href?: string }) {
  return (
    <Link href={href} className="logo" aria-label="VTH home">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="40" y2="40"><stop stopColor="#26262c" /><stop offset="1" stopColor="#121215" /></linearGradient>
          <linearGradient id="lg2" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ecdfbb" /><stop offset="1" stopColor="#c9a96a" /></linearGradient>
        </defs>
        <rect width="40" height="40" rx="10" fill="url(#lg)" stroke="#c9a96a" strokeOpacity=".55" />
        <path d="M10 12l6.2 16.5a1 1 0 001.9 0L24 12" stroke="#f1ede3" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M27 12h4M29 12v16" stroke="#f1ede3" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="32.5" cy="30.5" r="3" fill="url(#lg2)" />
      </svg>
      {text && <span className="logo-text">VTH<i>Rewards</i></span>}
    </Link>
  );
}

export function Aurora() {
  return (
    <div className="aurora" aria-hidden>
      <span className="blob b1" /><span className="blob b2" /><span className="blob b3" />
      <span className="grid" />
      {Array.from({ length: 22 }).map((_, i) => (
        <span key={i} className="mote" style={{ left: `${(i * 47) % 100}%`, animationDelay: `${(i * 0.9) % 12}s`, animationDuration: `${12 + (i % 7) * 2}s`, width: 2 + (i % 3), height: 2 + (i % 3) }} />
      ))}
    </div>
  );
}
