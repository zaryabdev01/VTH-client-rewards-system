"use client";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutDashboard, KeyRound, Gift, Mail, LogOut, Menu, Plus, ExternalLink, ScrollText, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Brand";
import { effectiveStatus, useStore } from "@/lib/store";

const NAV = [
  { href: "/staff", label: "Dashboard", icon: LayoutDashboard },
  { href: "/staff/codes", label: "Codes & history", icon: KeyRound },
  { href: "/staff/rewards", label: "Reward settings", icon: Gift },
  { href: "/staff/emails", label: "Email templates", icon: Mail },
  { href: "/staff/activity", label: "Activity log", icon: ScrollText },
  { href: "/staff/team", label: "Team & settings", icon: Users },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, logout, codes } = useStore();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => { if (ready && !user) router.replace("/staff/login"); }, [ready, user, router]);
  useEffect(() => setOpen(false), [path]);
  if (!ready || !user) return (<div className="theme-light" style={{ display: "grid", placeItems: "center" }}><span className="spinner" style={{ width: 30, height: 30 }} /></div>);
  const active = codes.filter((c) => effectiveStatus(c) === "active").length;

  return (
    <div className="theme-light">
      <div className="shell">
        {open && <div className="drawer-bg" style={{ zIndex: 70 }} onClick={() => setOpen(false)} />}
        <aside className={`sidebar ${open ? "open" : ""}`}>
          <Logo />
          <div className="nav-label">Workspace</div>
          {NAV.map((n) => {
            const on = n.href === "/staff" ? path === "/staff" : path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={`nav-item ${on ? "on" : ""}`}>
                {on && <motion.span layoutId="navpill" className="nav-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <n.icon size={18} /> {n.label}
                {n.href === "/staff/codes" && <span className="nav-count">{active}</span>}
              </Link>
            );
          })}
          <div className="nav-label">Customer site</div>
          <Link href="/" className="nav-item"><ExternalLink size={18} /> Open spin page</Link>
          <div className="usercard">
            <div className="avatar">{user.initials}</div>
            <div className="who"><b>{user.name}</b><small>{user.role}</small></div>
            <button className="icon-btn" onClick={() => { logout(); router.push("/staff/login"); }} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
          </div>
        </aside>
        <div className="main">
          <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", paddingTop: 18 }}>
            <button className="icon-btn burger" onClick={() => setOpen(true)} aria-label="Menu"><Menu size={18} /></button>
            <span />
            <button className="btn btn-gold btn-sm" onClick={() => (path === "/staff/codes" ? window.dispatchEvent(new Event("vth:new-code")) : router.push("/staff/codes?new=1"))}><Plus size={16} /> Generate new spin code</button>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={path} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}>{children}</motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
