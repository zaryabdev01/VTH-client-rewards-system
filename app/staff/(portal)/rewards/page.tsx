"use client";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Eye, ImageIcon, Lock, Pencil, RotateCcw, Save, Trash2, Upload, Video, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import PrizeModal, { videoSource } from "@/components/PrizeModal";
import Wheel, { ICONS, type WheelHandle } from "@/components/Wheel";
import { errMsg, useStore } from "@/lib/store";
import { type IconKey, type Reward } from "@/lib/shared";

export default function Rewards() {
  const { rewards, user, updateReward, uploadMedia, resetRewards, codes } = useStore();
  const toast = useToast();
  const admin = user?.role === "admin";
  const wheel = useRef<WheelHandle>(null);
  const [selId, setSelId] = useState<number | null>(null);
  const [hov, setHov] = useState<number | null>(null);
  const [draft, setDraft] = useState<Reward | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [peek, setPeek] = useState<Reward | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pct = (100 / rewards.length).toFixed(2);
  const won = useMemo(() => Object.fromEntries(rewards.map((r) => [r.id, codes.filter((c) => c.rewardId === r.id).length])), [rewards, codes]);
  const maxWon = Math.max(1, ...Object.values(won));

  // live-preview rewards include the unsaved draft
  const preview = rewards.map((r) => (draft && r.id === draft.id ? { ...r, ...draft } : r));
  const focus = hov ?? (selId ? rewards.findIndex((r) => r.id === selId) : -1);
  useEffect(() => { if (focus >= 0) wheel.current?.pointTo(focus); }, [focus]);

  const select = (r: Reward) => { setSelId(r.id); setDraft({ ...r }); };
  const close = () => { setSelId(null); setDraft(null); };
  const dirty = !!draft && !!selId && JSON.stringify(draft) !== JSON.stringify(rewards.find((r) => r.id === selId));
  const lines = draft?.label.split("|") ?? [];
  const labelWarn = lines.length > 2 || lines.some((l) => l.length > 14);

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!draft) return;
    try {
      await updateReward(draft.id, { name: draft.name.trim(), label: draft.label, desc: draft.desc.trim(), icon: draft.icon, mediaType: draft.mediaUrl ? draft.mediaType ?? null : null, mediaUrl: draft.mediaUrl || null });
      toast("Reward saved — wheel & rules page updated"); close();
    } catch (err) { toast(errMsg(err), "error"); }
  };
  const pickFile = async (f: File | undefined) => {
    if (!f || !draft) return;
    setUploading(true);
    try { const url = await uploadMedia(f); setDraft({ ...draft, mediaType: "image", mediaUrl: url }); toast("Image uploaded. Save to publish it"); }
    catch (e) { toast(errMsg(e), "error"); }
    setUploading(false); if (fileRef.current) fileRef.current.value = "";
  };
  const doReset = async () => {
    if (!confirmReset) { setConfirmReset(true); setTimeout(() => setConfirmReset(false), 3500); return; }
    try { await resetRewards(); setConfirmReset(false); close(); toast("All 12 sections reset to defaults"); } catch (err) { toast(errMsg(err), "error"); }
  };

  return (
    <>
      <div className="pagehead">
        <div><h1>Reward settings</h1><p>All 12 wheel sections, editable without a developer. Changes appear on the wheel and rules page instantly.</p></div>
        <div className="page-actions">
          {admin && <button className={`btn ${confirmReset ? "btn-danger" : "btn-ghost"}`} onClick={doReset}><RotateCcw size={15} /> {confirmReset ? "Click again to confirm" : "Reset to defaults"}</button>}
          <Link href="/rules" target="_blank" className="btn btn-ghost"><Eye size={16} /> View rules page</Link>
        </div>
      </div>
      {!admin && <div className="banner"><Lock size={18} /> You’re signed in as standard staff. Only admins can edit rewards — you can preview them here.</div>}

      <div className="rewards-layout">
        <div>
          <div className="glass card" style={{ display: "flex", gap: 28, flexWrap: "wrap", marginBottom: 16, alignItems: "center", padding: "18px 22px" }}>
            <div><div className="display" style={{ fontSize: 30, fontWeight: 500 }}>12<span style={{ color: "var(--dim)", fontSize: 17 }}> sections</span></div><div style={{ color: "var(--muted)", fontSize: 13 }}>Live on the wheel</div></div>
            <div><div className="display gold-text" style={{ fontSize: 30, fontWeight: 600 }}>{pct}%</div><div style={{ color: "var(--muted)", fontSize: 13 }}>Equal chance per section</div></div>
            <div style={{ flex: 1, minWidth: 220, color: "var(--muted)", fontSize: 13.5 }}>Prizes are picked on the server at redemption. Every section has the same probability and no stock limits.</div>
          </div>

          <div className="rgrid">
            {rewards.map((r, i) => {
              const I = ICONS[r.icon]; const on = selId === r.id;
              return (
                <motion.div key={r.id} className={`glass rcard ${on ? "on" : ""}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}
                  onClick={() => select(r)} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && select(r)} role="button" aria-pressed={on}>
                  <span className="num">{String(r.id).padStart(2, "0")}</span>
                  <div className="rico"><I size={21} /></div>
                  <h4>{r.name}</h4><p>{r.desc}</p>
                  <div className="usebar"><motion.i initial={{ width: 0 }} animate={{ width: `${(won[r.id] / maxWon) * 100}%` }} transition={{ duration: 0.8, delay: 0.3 }} /></div>
                  <div className="foot"><span>{won[r.id]} won · {pct}%</span>{admin ? <span style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--violet-2)" }}><Pencil size={13} /> Edit</span> : <Lock size={13} />}</div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <aside className="rside">
          <div className="dark-scope wheel-card">
            <div className="wc-head"><span>Live wheel preview</span><span className="wc-sub">{dirty ? "Unsaved changes" : "As clients see it"}</span></div>
            <div style={{ width: "min(100%, 340px)", margin: "10px auto 0" }}>
              <Wheel ref={wheel} rewards={preview} locked={false} ready={false} spinning={false} winnerIndex={focus >= 0 ? focus : null} onSpin={() => {}} />
            </div>
            <div className="wc-foot">{focus >= 0 ? <b>{preview[focus].name}</b> : "Hover or select a reward to highlight its section"}</div>
          </div>

          <AnimatePresence mode="wait">
            {draft && (
              <motion.form key={draft.id} className="glass card editor" onSubmit={save} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="eyebrow">Section {draft.id} of 12</span>
                  <button type="button" className="icon-btn" onClick={close} aria-label="Close editor"><X size={15} /></button>
                </div>
                <fieldset disabled={!admin} style={{ border: 0, display: "grid", gap: 14, marginTop: 16 }}>
                  <div className="field"><label htmlFor="rn">Reward name</label><input id="rn" className="input" required maxLength={48} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
                  <div className="field"><label htmlFor="rl">Wheel label <span style={{ fontWeight: 400, color: "var(--dim)" }}>— use | for a line break</span></label>
                    <input id="rl" className="input" required value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
                    {labelWarn ? <small style={{ color: "var(--amber)", display: "flex", gap: 5, alignItems: "center" }}><AlertTriangle size={12} /> Max 2 lines of 14 characters to fit the wheel</small> : <small style={{ color: "var(--dim)" }}>{lines.length} line{lines.length > 1 ? "s" : ""} · fits the wheel</small>}</div>
                  <div className="field"><label htmlFor="rd">Description shown to the client</label><textarea id="rd" className="input" rows={3} maxLength={400} value={draft.desc} onChange={(e) => setDraft({ ...draft, desc: e.target.value })} /><small style={{ color: "var(--dim)", textAlign: "right" }}>{draft.desc.length}/400</small></div>
                  <div className="field"><label>Icon</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {(Object.keys(ICONS) as IconKey[]).map((k) => { const K = ICONS[k]; const on = draft.icon === k; return (
                        <button type="button" key={k} onClick={() => setDraft({ ...draft, icon: k })} className="icon-btn" style={{ width: 38, height: 38, borderColor: on ? "var(--gold)" : undefined, color: on ? "var(--gold-2)" : undefined, background: on ? "rgba(154,123,63,.1)" : undefined }} aria-pressed={on} aria-label={k}><K size={17} /></button>); })}
                    </div></div>
                  <div className="field"><label>Image or video <span style={{ fontWeight: 400, color: "var(--dim)" }}>(shown in the prize pop-up)</span></label>
                    <div className="mediabox">
                      <div className="thumb">
                        {draft.mediaType === "image" && draft.mediaUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={draft.mediaUrl} alt="" />
                          : draft.mediaType === "video" && draft.mediaUrl ? (videoSource(draft.mediaUrl) ? <span style={{ display: "flex", gap: 8, alignItems: "center" }}><Video size={18} /> Video attached</span> : <span style={{ color: "var(--amber)" }}>Use a YouTube, Vimeo or .mp4 link</span>)
                          : <span style={{ display: "flex", gap: 8, alignItems: "center" }}><ImageIcon size={18} /> No media yet</span>}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
                        <button type="button" className="btn btn-ghost btn-sm" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? <span className="spinner" /> : <><Upload size={14} /> Upload image</>}</button>
                        {draft.mediaUrl && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft({ ...draft, mediaType: undefined, mediaUrl: undefined })}><Trash2 size={14} /> Remove</button>}
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPeek({ ...draft })}><Eye size={14} /> Preview pop-up</button>
                      </div>
                      <input className="input" placeholder="…or paste a video link (YouTube, Vimeo, .mp4) or image link" value={draft.mediaUrl && !draft.mediaUrl.startsWith("/api/media/") ? draft.mediaUrl : ""}
                        onChange={(e) => { const v = e.target.value.trim(); setDraft({ ...draft, mediaUrl: v || undefined, mediaType: v ? (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(v) ? "image" : "video") : undefined }); }} />
                      <small style={{ color: "var(--dim)" }}>Images: PNG, JPG, WebP or GIF up to 3 MB. Videos: paste a link so nothing heavy is stored here.</small>
                    </div></div>
                </fieldset>
                {admin ? (
                  <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                    <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={close}>Cancel</button>
                    <button className="btn btn-primary" style={{ flex: 1.5 }} disabled={!dirty || labelWarn}><Save size={16} /> Save changes</button>
                  </div>
                ) : <p style={{ fontSize: 13, color: "var(--dim)", marginTop: 14 }}>Read-only for standard staff.</p>}
              </motion.form>
            )}
          </AnimatePresence>
        </aside>
      </div>
      <AnimatePresence>{peek && <PrizeModal key="peek" reward={peek} onClose={() => setPeek(null)} />}</AnimatePresence>
    </>
  );
}
