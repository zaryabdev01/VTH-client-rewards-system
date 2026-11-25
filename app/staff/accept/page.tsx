"use client";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, Check, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Aurora, Logo } from "@/components/Brand";
import { api, ApiErr } from "@/lib/api";

/** Landing page for the invite email: validates the token, lets the new member choose a password, signs them in. */
export default function Accept() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [who, setWho] = useState<{ name: string; email: string } | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "bad">("loading");
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(t);
    api.get<{ name: string; email: string }>(`/api/auth/invite?token=${encodeURIComponent(t)}`).then((d) => { setWho(d); setState("ok"); }).catch(() => setState("bad"));
  }, []);

  const rules = [[pw.length >= 10, "At least 10 characters"], [/[a-z]/i.test(pw) && /\d/.test(pw), "Letters and a number"], [pw.length > 0 && pw === pw2, "Both passwords match"]] as const;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try { await api.post("/api/auth/invite", { token, password: pw }); router.push("/staff"); }
    catch (err) { setError(err instanceof ApiErr ? err.message : "Something went wrong"); setBusy(false); }
  };

  return (
    <>
      <Aurora />
      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <motion.div className="glass login-card" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ marginBottom: 22 }}><Logo /></div>
          {state === "loading" && <div style={{ display: "grid", placeItems: "center", padding: 30 }}><span className="spinner" /></div>}
          {state === "bad" && (<><h1 style={{ fontSize: 26 }}>Link expired</h1><p style={{ color: "var(--muted)", marginTop: 8 }}>This invitation link is invalid, already used, or has expired. Ask an admin to send you a new invitation.</p></>)}
          {state === "ok" && who && (
            <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
              <div><h1 style={{ fontSize: 26 }}>Welcome, {who.name.split(" ")[0]}</h1><p style={{ color: "var(--muted)", marginTop: 6, fontSize: 14.5 }}>Choose a password for <b style={{ color: "var(--text)" }}>{who.email}</b> to finish setting up your account.</p></div>
              <div className="field"><label htmlFor="a1">New password</label><div style={{ position: "relative" }}><Lock size={17} style={{ position: "absolute", left: 14, top: 15, color: "var(--dim)" }} /><input id="a1" className="input" style={{ paddingLeft: 42 }} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></div></div>
              <div className="field"><label htmlFor="a2">Confirm password</label><div style={{ position: "relative" }}><Lock size={17} style={{ position: "absolute", left: 14, top: 15, color: "var(--dim)" }} /><input id="a2" className="input" style={{ paddingLeft: 42 }} type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required /></div></div>
              <ul style={{ listStyle: "none", display: "grid", gap: 6, fontSize: 13 }}>{rules.map(([ok, t]) => (<li key={t} style={{ display: "flex", gap: 8, alignItems: "center", color: ok ? "var(--teal)" : "var(--dim)" }}><Check size={14} style={{ opacity: ok ? 1 : 0.3 }} />{t}</li>))}</ul>
              {error && <div className="errbox" role="alert" style={{ margin: 0 }}><AlertCircle size={18} /><div>{error}</div></div>}
              <button className="btn btn-primary btn-lg" disabled={busy || !rules.every(([ok]) => ok)}>{busy ? <span className="spinner" /> : <>Create account <ArrowRight size={18} /></>}</button>
            </form>
          )}
        </motion.div>
      </div>
    </>
  );
}
