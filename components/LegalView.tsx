"use client";
import { Check, Copy, Download, Printer, Share2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import type { LegalDoc } from "@/lib/shared";

/** Tiny markdown subset: "# " / "## " headings, "- " bullets, blank-line paragraphs. Plain text only: nothing is injected as HTML. */
export function Prose({ text }: { text: string }) {
  const out: React.ReactNode[] = []; let list: string[] = []; let k = 0;
  const flush = () => { if (list.length) { out.push(<ul key={k++}>{list.map((l, i) => <li key={i}>{l}</li>)}</ul>); list = []; } };
  for (const block of text.replace(/\r/g, "").split(/\n{2,}/)) {
    for (const line of block.split("\n")) {
      const t = line.trim(); if (!t) continue;
      if (t.startsWith("- ") || t.startsWith("* ")) { list.push(t.slice(2)); continue; }
      flush();
      if (t.startsWith("## ")) out.push(<h3 key={k++}>{t.slice(3)}</h3>);
      else if (t.startsWith("# ")) out.push(<h2 key={k++}>{t.slice(2)}</h2>);
      else out.push(<p key={k++}>{t}</p>);
    }
    flush();
  }
  return <div className="prose">{out}</div>;
}

/** A legal page that can be read, shared and downloaded. */
export default function LegalView({ doc }: { doc: LegalDoc }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare("share" in navigator), []);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const share = async () => {
    try {
      if (canShare) { await navigator.share({ title: doc.title, url }); return; }
      await navigator.clipboard.writeText(url); setCopied(true); toast("Link copied"); setTimeout(() => setCopied(false), 2000);
    } catch { /* cancelled */ }
  };
  const txt = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([doc.body.replace(/^#{1,2} /gm, "")], { type: "text/plain;charset=utf-8" }));
    a.download = `${doc.slug}.txt`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <article className="legal glass">
      <div className="legal-actions no-print">
        <button className="btn btn-ghost btn-sm" onClick={share}>{copied ? <Check size={15} /> : canShare ? <Share2 size={15} /> : <Copy size={15} />} {canShare ? "Share" : "Copy link"}</button>
        {doc.pdfUrl ? <a className="btn btn-ghost btn-sm" href={doc.pdfUrl} target="_blank" rel="noopener" download><Download size={15} /> Download PDF</a>
          : <button className="btn btn-ghost btn-sm" onClick={() => window.print()}><Download size={15} /> Download PDF</button>}
        <button className="btn btn-ghost btn-sm" onClick={() => window.print()}><Printer size={15} /> Print</button>
        <button className="btn btn-ghost btn-sm" onClick={txt}>Text file</button>
      </div>
      <Prose text={doc.body} />
      {doc.updatedAt && <p className="legal-date">Last updated {new Date(doc.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>}
    </article>
  );
}
