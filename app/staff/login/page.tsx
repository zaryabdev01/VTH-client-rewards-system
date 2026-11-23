"use client";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles, BarChart3, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Aurora, Logo } from "@/components/Brand";
import { useStore, type Role } from "@/lib/store";

export default function Login() {
  const { login } = useStore();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async (role: Role) => { setBusy(true); await new Promise((r) => setTimeout(r, 800)); login(role); router.push("/staff"); };

  return (
    <>
      <Aurora />
      <div className="login">
        <section className="login-art">
          <Logo size={40} />
          <div>
            <span className="eyebrow"><Sparkles size={14} /> Staff portal</span>
            <motion.h2 style={{ marginTop: 22 }} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>Make every client call <span className="gold-text">memorable.</span></motion.h2>
            <div style={{ display: "grid", gap: 16, marginTop: 34, maxWidth: 440 }}>
              {[[Send, "Issue & email one-time codes in seconds"], [BarChart3, "Track redemptions and rewards live"], [ShieldCheck, "Role-based access with a full audit trail"]].map(([I, t], i) => {
                const Icon = I as typeof Send;
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.12 }} style={{ display: "flex", gap: 14, alignItems: "center", color: "var(--muted)" }}>
                    <span className="rico" style={{ margin: 0, width: 40, height: 40 }}><Icon size={18} /></span>{t as string}
                  </motion.div>
                );
              })}
            </div>
          </div>
          <small style={{ color: "var(--dim)" }}>© VTH · Design prototype</small>
        </section>

        <section className="login-form">
          <motion.div className="glass login-card" initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", damping: 22, stiffness: 120 }}>
            <h1 style={{ fontSize: 28 }}>Welcome back</h1>
            <p style={{ color: "var(--muted)", margin: "6px 0 24px", fontSize: 14.5 }}>Sign in to manage Thank You Spin codes.</p>
            <form onSubmit={(e) => { e.preventDefault(); go("admin"); }} style={{ display: "grid", gap: 16 }}>
              <div className="field"><label htmlFor="e">Work email</label>
                <div style={{ position: "relative" }}><Mail size={17} style={{ position: "absolute", left: 14, top: 15, color: "var(--dim)" }} /><input id="e" className="input" style={{ paddingLeft: 42 }} defaultValue="olivia.hart@vth.co.uk" type="email" /></div></div>
              <div className="field"><label htmlFor="p">Password</label>
                <div style={{ position: "relative" }}><Lock size={17} style={{ position: "absolute", left: 14, top: 15, color: "var(--dim)" }} />
                  <input id="p" className="input" style={{ paddingLeft: 42, paddingRight: 44 }} type={show ? "text" : "password"} defaultValue="prototype-demo" />
                  <button type="button" className="icon-btn" style={{ position: "absolute", right: 5, top: 5, border: 0, background: "transparent" }} onClick={() => setShow(!show)} aria-label="Toggle password">{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
              <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? <span className="spinner" /> : <>Sign in <ArrowRight size={18} /></>}</button>
            </form>
            <div className="divider">Prototype quick sign-in</div>
            <div className="role-pick">
              <button onClick={() => go("admin")} disabled={busy}><b>Admin</b><span>Full access, edits rewards</span></button>
              <button onClick={() => go("standard")} disabled={busy}><b>Standard staff</b><span>Codes only, rewards read-only</span></button>
            </div>
          </motion.div>
        </section>
      </div>
    </>
  );
}
