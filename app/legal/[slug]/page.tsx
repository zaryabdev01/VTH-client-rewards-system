"use client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Aurora, Logo } from "@/components/Brand";
import LegalView from "@/components/LegalView";
import { api } from "@/lib/api";
import { DEFAULT_LEGAL, type LegalDoc } from "@/lib/shared";

const LEGAL_NAV = [["terms", "Terms & Conditions"], ["privacy", "Privacy Notice"], ["prize-rules", "Prize Rules"]] as const;

export default function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [docs, setDocs] = useState<LegalDoc[]>(DEFAULT_LEGAL);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { api.get<{ docs: LegalDoc[] }>("/api/public/legal").then((d) => setDocs(d.docs)).catch(() => {}).finally(() => setLoaded(true)); }, []);
  const doc = docs.find((d) => d.slug === slug);
  return (
    <>
      <Aurora />
      <div className="page">
        <header className="topbar no-print"><Logo /><nav><Link className="link" href="/"><ArrowLeft size={14} style={{ display: "inline", verticalAlign: -2 }} /> Back to the wheel</Link></nav></header>
        <main className="rules">
          <nav className="legal-tabs no-print" aria-label="Legal pages">
            {LEGAL_NAV.map(([s, l]) => <Link key={s} href={`/legal/${s}`} className={s === slug ? "on" : ""}>{l}</Link>)}
          </nav>
          {doc ? <LegalView doc={doc} /> : loaded && <p style={{ color: "var(--muted)" }}>That page doesn’t exist.</p>}
        </main>
      </div>
    </>
  );
}
