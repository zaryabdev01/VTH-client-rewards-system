"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Database, Hash, Lock, Mail, ShieldCheck, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { fmtRelative, useStore, type Role } from "@/lib/store";

export default function Team() {
  const { team, settings, updateSettings, updateMember, inviteMember, user } = useStore();
  const toast = useToast();
  const admin = user?.role === "admin";
  const [invite, setInvite] = useState(false);
  const [f, setF] = useState<{ name: string; email: string; role: Role }>({ name: "", email: "", role: "standard" });
  const submit = (e: React.FormEvent) => { e.preventDefault(); inviteMember(f); toast(`Invitation sent to ${f.email}`); setInvite(false); setF({ name: "", email: "", role: "standard" }); };
  const admins = team.filter((m) => m.role === "admin" && m.active).length;

  return (
    <>
      <div className="pagehead">
        <div><h1>Team &amp; settings</h1><p>Control who can access the portal and how new codes behave by default.</p></div>
        {admin && <button className="btn btn-primary" onClick={() => setInvite(true)}><UserPlus size={16} /> Invite member</button>}
      </div>
      {!admin && <div className="banner"><Lock size={18} /> Only admins can change team access and settings. You’re viewing in read-only mode.</div>}

      <div className="grid2" style={{ marginTop: 0, alignItems: "start" }}>
        <div className="glass tablewrap">
          <table style={{ minWidth: 560 }}>
            <thead><tr><th>Member</th><th>Role</th><th>Last active</th><th style={{ textAlign: "right" }}>Access</th></tr></thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.id} style={{ cursor: "default", opacity: m.active ? 1 : 0.55 }}>
                  <td><div style={{ display: "flex", gap: 12, alignItems: "center" }}><div className="avatar" style={{ width: 36, height: 36, fontSize: 12 }}>{m.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}</div>
                    <div><b>{m.name}</b>{m.invited && <span className="chip pending" style={{ marginLeft: 8 }}>Invited</span>}<div className="sub">{m.email}</div></div></div></td>
                  <td>
                    <select className="input" style={{ width: 140, padding: "8px 34px 8px 12px", fontSize: 13.5 }} disabled={!admin || (m.role === "admin" && admins <= 1)} value={m.role}
                      onChange={(e) => { updateMember(m.id, { role: e.target.value as Role }); toast(`${m.name.split(" ")[0]} is now ${e.target.value}`); }} aria-label={`Role for ${m.name}`}>
                      <option value="admin">Admin</option><option value="standard">Standard</option>
                    </select>
                  </td>
                  <td style={{ color: "var(--muted)" }}>{fmtRelative(m.lastActive)}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className={`toggle ${m.active ? "on" : ""}`} disabled={!admin || (m.role === "admin" && admins <= 1 && m.active)} role="switch" aria-checked={m.active} aria-label={`Access for ${m.name}`}
                      onClick={() => { updateMember(m.id, { active: !m.active }); toast(m.active ? `${m.name.split(" ")[0]} deactivated` : `${m.name.split(" ")[0]} re-activated`); }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="perm-note"><ShieldCheck size={15} /> <span><b>Admin</b> — generate &amp; send codes, edit rewards and emails, manage the team. <b>Standard</b> — generate &amp; send codes, mark rewards fulfilled; rewards are read-only.</span></div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div className="glass card">
            <h3>Code defaults</h3>
            <fieldset disabled={!admin} style={{ border: 0, display: "grid", gap: 16, marginTop: 16 }}>
              <div className="field"><label htmlFor="de">Default code expiry</label>
                <select id="de" className="input" value={settings.defaultExpiry} onChange={(e) => { updateSettings({ defaultExpiry: +e.target.value }); toast("Default expiry updated"); }}>
                  {[1, 7, 14, 30, 90].map((d) => <option key={d} value={d}>{d === 1 ? "24 hours" : `${d} days`}</option>)}
                </select></div>
              <label className="check" style={{ background: "transparent" }}><input type="checkbox" checked={settings.staffCanChangeExpiry} onChange={(e) => { updateSettings({ staffCanChangeExpiry: e.target.checked }); toast("Setting updated"); }} />
                <span><b>Let standard staff change expiry per code</b><small>When off, staff always use the default above.</small></span></label>
            </fieldset>
          </div>
          <div className="glass card">
            <h3>Platform</h3>
            <div className="plat">
              <div><Hash size={16} /><span><b>Code format</b><small>VTH-XXXX-XXXX · long, random, no prize info</small></span></div>
              <div><ShieldCheck size={16} /><span><b>Bot protection &amp; rate limit</b><small>Cloudflare Turnstile · 5 failed tries → 30s lock</small></span></div>
              <div><Mail size={16} /><span><b>Email provider</b><small>Postmark or Resend — to be confirmed</small></span></div>
              <div><Database size={16} /><span><b>Data retention</b><small>Period to be agreed (UK GDPR)</small></span></div>
              <div><Clock size={16} /><span><b>Session length</b><small>Secure cookie · 8 hours</small></span></div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {invite && (
          <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setInvite(false)}>
            <motion.form className="modal" onSubmit={submit} onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ type: "spring", stiffness: 300, damping: 28 }}>
              <button type="button" className="icon-btn" style={{ position: "absolute", right: 18, top: 18 }} onClick={() => setInvite(false)} aria-label="Close"><X size={16} /></button>
              <span className="eyebrow">Invite</span>
              <h2 style={{ fontSize: 24, margin: "14px 0 18px" }}>Add a team member</h2>
              <div style={{ display: "grid", gap: 14 }}>
                <div className="field"><label htmlFor="in">Full name</label><input id="in" className="input" required autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
                <div className="field"><label htmlFor="ie">Work email</label><input id="ie" className="input" type="email" required placeholder="name@vth.co.uk" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
                <div className="field"><label htmlFor="ir">Role</label><select id="ir" className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}><option value="standard">Standard staff</option><option value="admin">Admin</option></select></div>
              </div>
              <button className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 20 }}><UserPlus size={17} /> Send invitation</button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
