"use client";
import { motion } from "framer-motion";
import { Check, Gift, Lock, Monitor, Repeat, RotateCcw, Save, Send, Smartphone } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/Brand";
import { useToast } from "@/components/Toast";
import { errMsg, useStore } from "@/lib/store";
import { DEFAULT_TEMPLATES, renderTpl, type Templates } from "@/lib/shared";

type Kind = "code" | "reward" | "recurring";
const FIELDS: Record<Kind, string[]> = { code: ["name", "expiry"], reward: ["name", "reward", "ref"], recurring: ["name", "count", "expiry"] };
const KEYS: Record<Kind, { subj: keyof Templates; body: keyof Templates }> = {
  code: { subj: "codeSubject", body: "codeBody" }, reward: { subj: "rewardSubject", body: "rewardBody" }, recurring: { subj: "recurringSubject", body: "recurringBody" },
};

export default function Emails() {
  const { templates, saveTemplates, sendTestEmail, user } = useStore();
  const toast = useToast();
  const admin = user?.role === "admin";
  const [kind, setKind] = useState<Kind>("code");
  const [mobile, setMobile] = useState(false);
  const [draft, setDraft] = useState<Templates>(templates);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setDraft(templates); }, [templates]);

  const { subj: subjKey, body: bodyKey } = KEYS[kind];
  const dirty = JSON.stringify(draft) !== JSON.stringify(templates);

  const vars = useMemo(() => ({
    name: "Sarah", code: "VTH-7K2M-9QXA-W4TC", reward: "£25 Learning Credit", ref: "REF-A7K29XQ2", count: "are your 2 fresh codes",
    expiry: new Date(Date.now() + 14 * 864e5).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
  }), []);
  const render = (t: string) => renderTpl(t, vars);
  const paras = render(draft[bodyKey]).split(/\n\n+/);
  const nl = (t: string) => t.split("\n").map((l, i, a) => <span key={i}>{l}{i < a.length - 1 && <br />}</span>);

  const insert = (f: string) => {
    const el = bodyRef.current; const tag = `{{${f}}}`;
    const v = draft[bodyKey];
    if (!el) return setDraft({ ...draft, [bodyKey]: v + tag });
    const a = el.selectionStart ?? v.length, b = el.selectionEnd ?? v.length;
    setDraft({ ...draft, [bodyKey]: v.slice(0, a) + tag + v.slice(b) });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + tag.length, a + tag.length); });
  };
  const save = async () => { setSaving(true); try { await saveTemplates(draft); toast("Email templates saved"); } catch (e) { toast(errMsg(e), "error"); } setSaving(false); };
  const reset = () => { setDraft((d) => ({ ...d, [subjKey]: DEFAULT_TEMPLATES[subjKey], [bodyKey]: DEFAULT_TEMPLATES[bodyKey], signOff: DEFAULT_TEMPLATES.signOff })); toast("Reset to the default wording — save to apply"); };
  const test = async () => {
    setSending(true);
    try { if (dirty && admin) await saveTemplates(draft); const to = await sendTestEmail(kind); toast(`Test email sent to ${to}`); }
    catch (e) { toast(errMsg(e), "error"); }
    setSending(false);
  };

  const codeBox = (c: string) => <div className="mail-code" key={c}>{c}</div>;
  const special = kind === "code" ? (
    <><div className="mail-code">{vars.code}</div><p style={{ textAlign: "center", margin: "0 0 18px" }}><span className="mail-btn">Unlock My Spin →</span></p></>
  ) : kind === "recurring" ? (
    <>{codeBox("VTH-7K2M-9QXA-W4TC")}{codeBox("VTH-R5TD-H3ZN-8PLV")}<p style={{ textAlign: "center", margin: "0 0 18px" }}><span className="mail-btn">Unlock My Spin →</span></p></>
  ) : (
    <div style={{ margin: "16px 0", padding: 18, borderRadius: 12, background: "#faf6ec", border: "1px solid #eadfc2", textAlign: "center", color: "#4a3a14" }}>
      <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", fontWeight: 600, color: "#9a7b3f" }}>Your reward</div>
      <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4, fontFamily: "var(--font-serif)" }}>{vars.reward}</div>
      <div className="mono" style={{ marginTop: 6, fontSize: 13 }}>{vars.ref}</div>
    </div>
  );

  return (
    <>
      <div className="pagehead">
        <div><h1>Email templates</h1><p>Edit the wording clients receive. Changes apply to every email sent from the portal.</p></div>
        <div className="seg" role="group" aria-label="Device">
          {([[false, Monitor, "Desktop"], [true, Smartphone, "Mobile"]] as const).map(([m, I, l]) => (
            <button key={l} className={mobile === m ? "on" : ""} onClick={() => setMobile(m)}>{mobile === m && <motion.span layoutId="devpill" className="seg-pill" />}<I size={15} /><span>{l}</span></button>
          ))}
        </div>
      </div>
      {!admin && <div className="banner"><Lock size={18} /> Standard staff can preview templates. Only admins can edit the wording.</div>}

      <div className="seg" role="tablist" style={{ marginBottom: 16, maxWidth: "100%", overflowX: "auto" }}>
        {([["code", Send, "Spin code email"], ["recurring", Repeat, "Recurring spin email"], ["reward", Gift, "Reward confirmation"]] as const).map(([k, I, l]) => (
          <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>{kind === k && <motion.span layoutId="tabpill2" className="seg-pill" />}<I size={15} /><span>{l}</span></button>
        ))}
      </div>

      <div className="mail-layout">
        <div className="glass card editor-col">
          <h3>Content</h3>
          <fieldset disabled={!admin} style={{ border: 0, display: "grid", gap: 14, marginTop: 16 }}>
            <div className="field"><label htmlFor="sj">Subject line</label><input id="sj" className="input" value={draft[subjKey]} onChange={(e) => setDraft({ ...draft, [subjKey]: e.target.value })} /></div>
            <div className="field">
              <label htmlFor="bd">Message</label>
              <div className="chips-row"><span>Insert:</span>{FIELDS[kind].map((f) => <button type="button" key={f} className="mchip" onClick={() => insert(f)}>{`{{${f}}}`}</button>)}</div>
              <textarea id="bd" ref={bodyRef} className="input" rows={10} value={draft[bodyKey]} onChange={(e) => setDraft({ ...draft, [bodyKey]: e.target.value })} />
              <small style={{ color: "var(--dim)" }}>Leave a blank line between paragraphs. {kind === "reward" ? "The reward and reference box is added automatically." : "The code(s) and button are added automatically."}</small>
            </div>
            <div className="field"><label htmlFor="so">Sign-off</label><textarea id="so" className="input" rows={2} value={draft.signOff} onChange={(e) => setDraft({ ...draft, signOff: e.target.value })} /></div>
          </fieldset>
          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            <button className="btn btn-ghost" onClick={test} disabled={sending}>{sending ? <span className="spinner" /> : <><Send size={15} /> Send test to me</>}</button>
            {admin && <button className="btn btn-ghost" onClick={reset}><RotateCcw size={15} /> Reset</button>}
            {admin && <button className="btn btn-primary" style={{ marginLeft: "auto" }} disabled={!dirty || saving} onClick={save}>{saving ? <span className="spinner" /> : dirty ? <><Save size={15} /> Save changes</> : <><Check size={15} /> Saved</>}</button>}
          </div>
          <div className="meta-list">
            <div><span>From</span>VTH Rewards &lt;rewards@vth.co.uk&gt;</div>
            <div><span>Delivery</span>Resend · SPF &amp; DKIM on VTH’s domain · every send is logged</div>
          </div>
        </div>

        <div className="mail-stage" style={{ marginTop: 0 }}>
          <motion.div key={kind + mobile} className={`mail-frame ${mobile ? "mobile" : ""}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="mail-bar">
              <b>{render(draft[subjKey])}</b>
              <span>From VTH Rewards &lt;rewards@vth.co.uk&gt; · To Sarah Mitchell</span>
            </div>
            <div className="mail-body"><div className="mail-card">
              <div className="mail-head"><div style={{ display: "inline-flex" }}><Logo size={36} href="#" /></div></div>
              <div className="mail-content">
                {paras.map((p, i) => (
                  <div key={i}>
                    {i === 0 && kind === "reward" ? <h2>{nl(p)}</h2> : <p style={{ marginBottom: 14 }}>{nl(p)}</p>}
                    {i === 1 && special}
                  </div>
                ))}
                {paras.length < 2 && special}
                <p style={{ marginTop: 22, color: "#343866" }}>{nl(draft.signOff)}</p>
              </div>
              <div className="mail-foot">VTH · Privacy notice · Prize terms · Unsubscribe</div>
            </div></div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
