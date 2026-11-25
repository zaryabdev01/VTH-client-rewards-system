"use client";
import { motion } from "framer-motion";
import { Eye, FileText, Lock, Save, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/api";
import { errMsg, useStore } from "@/lib/store";
import { DEFAULT_LEGAL, type LegalDoc } from "@/lib/shared";

export default function LegalAdmin() {
  const { user, saveLegal, uploadMedia } = useStore();
  const toast = useToast();
  const admin = user?.role === "admin";
  const [docs, setDocs] = useState<LegalDoc[]>(DEFAULT_LEGAL);
  const [slug, setSlug] = useState<string>("terms");
  const [draft, setDraft] = useState<LegalDoc>(DEFAULT_LEGAL[0]);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => { api.get<{ docs: LegalDoc[] }>("/api/public/legal").then((d) => { setDocs(d.docs); setDraft(d.docs.find((x) => x.slug === "terms") ?? d.docs[0]); }).catch(() => {}); }, []);
  const pick = (s: string) => { setSlug(s); setDraft(docs.find((d) => d.slug === s)!); };
  const dirty = JSON.stringify({ t: draft.title, b: draft.body, p: draft.pdfUrl ?? null }) !== JSON.stringify((() => { const d = docs.find((x) => x.slug === slug)!; return { t: d.title, b: d.body, p: d.pdfUrl ?? null }; })());

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { const next = await saveLegal({ slug, title: draft.title, body: draft.body, pdfUrl: draft.pdfUrl ?? null }); setDocs(next); setDraft(next.find((d) => d.slug === slug)!); toast("Page published"); }
    catch (err) { toast(errMsg(err), "error"); }
    setBusy(false);
  };
  const upload = async (f?: File) => {
    if (!f) return; setBusy(true);
    try { if (f.type !== "application/pdf") throw new Error("Please choose a PDF file"); const url = await uploadMedia(f); setDraft({ ...draft, pdfUrl: url }); toast("PDF uploaded. Save to publish it"); }
    catch (err) { toast(errMsg(err), "error"); }
    setBusy(false); if (file.current) file.current.value = "";
  };

  return (
    <>
      <div className="pagehead">
        <div><h1>Legal pages</h1><p>The Terms &amp; Conditions, Privacy Notice and Prize Rules shown on the spin site. Paste in VTH’s approved wording. Visitors can read, share and download each one.</p></div>
        <div className="page-actions"><Link href={`/legal/${slug}`} target="_blank" className="btn btn-ghost"><Eye size={16} /> View live page</Link></div>
      </div>
      {!admin && <div className="banner"><Lock size={18} /> Only admins can edit these pages.</div>}

      <div className="seg" style={{ marginBottom: 16, width: "fit-content", maxWidth: "100%", overflowX: "auto" }}>
        {docs.map((d) => (<button key={d.slug} className={slug === d.slug ? "on" : ""} onClick={() => pick(d.slug)}>{slug === d.slug && <motion.span layoutId="legaltab" className="seg-pill" />}<span>{d.title}</span></button>))}
      </div>

      <form className="glass card" onSubmit={save}>
        <fieldset disabled={!admin || busy} style={{ border: 0, display: "grid", gap: 16 }}>
          <div className="field"><label htmlFor="lt">Page title</label><input id="lt" className="input" required maxLength={120} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
          <div className="field">
            <label htmlFor="lb">Content</label>
            <textarea id="lb" className="input" rows={18} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 13.5, lineHeight: 1.6 }} />
            <small style={{ color: "var(--dim)" }}>Formatting: <code># Heading</code>, <code>## Sub-heading</code>, <code>- bullet</code>, and a blank line between paragraphs.</small>
          </div>
          <div className="field">
            <label>PDF version <span style={{ fontWeight: 400, color: "var(--dim)" }}>(optional)</span></label>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input ref={file} type="file" accept="application/pdf" hidden onChange={(e) => upload(e.target.files?.[0])} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => file.current?.click()}><Upload size={14} /> {draft.pdfUrl ? "Replace PDF" : "Upload PDF"}</button>
              {draft.pdfUrl && <><a className="btn btn-ghost btn-sm" href={draft.pdfUrl} target="_blank" rel="noopener"><FileText size={14} /> Open PDF</a><button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft({ ...draft, pdfUrl: undefined })}><Trash2 size={14} /> Remove</button></>}
              <small style={{ color: "var(--dim)" }}>{draft.pdfUrl ? "The “Download PDF” button gives visitors this file." : "Without one, “Download PDF” prints the page to PDF."}</small>
            </div>
          </div>
        </fieldset>
        {admin && <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}><button className="btn btn-primary" disabled={!dirty || busy}>{busy ? <span className="spinner" /> : <><Save size={16} /> Publish changes</>}</button></div>}
      </form>
    </>
  );
}
