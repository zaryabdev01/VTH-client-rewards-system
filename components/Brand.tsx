"use client";
import Link from "next/link";

export function Logo({ size = 34, text = true, href = "/" }: { size?: number; text?: boolean; href?: string }) {
  return (
    <Link href={href} className="logo" aria-label="Vocational Training Hub – Thank You Spin">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo-img logo-on-dark" src="/vth-logo-white.svg" alt="Vocational Training Hub" height={size} style={{ height: size, width: "auto" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo-img logo-on-light" src="/vth-logo.svg" alt="" aria-hidden height={size} style={{ height: size, width: "auto" }} />
      {text && <span className="logo-tag">Thank You Spin</span>}
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
