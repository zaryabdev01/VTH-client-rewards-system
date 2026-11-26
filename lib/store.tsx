"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiErr } from "./api";
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATES, type Activity, type Code, type Frequency, type LegalDoc, type Member, type Plan, type Reward, type Role, type Settings, type Templates, type User } from "./shared";


type Boot = { user: User; codes: Code[]; rewards: Reward[]; activity: Activity[]; templates: Templates; settings: Settings; team: Member[]; plans: Plan[]; system: System };
export type System = { database: "postgres" | "embedded"; turnstile: boolean; email: boolean; emailProvider?: "smtp" | "resend" | "log"; cron: boolean; appUrl: string | null };
export type PlanInput = {
  people: { name: string; org: string; email: string }[]; frequency: Frequency; spinsPerCycle: number; expireAtNext: boolean; codeValidityDays: number;
  startsAt?: string; maxCycles?: number | null; endsAt?: string | null;
};
export type RewardInput = Pick<Reward, "name" | "label" | "desc" | "icon"> & { mediaType?: "image" | "video" | null; mediaUrl?: string | null };

type Ctx = {
  ready: boolean; user: User | null;
  codes: Code[]; rewards: Reward[]; activity: Activity[]; templates: Templates; settings: Settings; team: Member[]; plans: Plan[];
  staffNames: string[]; system: System | null;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  generateCode: (d: { name: string; org: string; email: string; days: number; spins: number; sendNow: boolean }) => Promise<{ code: Code; emailed: boolean }>;
  sendCode: (id: string) => Promise<void>; cancelCode: (id: string) => Promise<void>; fulfil: (id: string) => Promise<void>;
  updateReward: (id: number, p: RewardInput) => Promise<void>; uploadMedia: (file: File) => Promise<string>;
  bulkCodes: (ids: string[], action: "cancel" | "send") => Promise<{ done: number; skipped: number }>;
  bulkPlans: (ids: string[], action: "pause" | "resume" | "cancel") => Promise<{ done: number; skipped: number }>;
  saveLegal: (d: { slug: string; title: string; body: string; pdfUrl?: string | null }) => Promise<LegalDoc[]>; resetRewards: () => Promise<void>;
  saveTemplates: (t: Templates) => Promise<void>; saveSettings: (s: Settings) => Promise<void>;
  updateMember: (id: string, p: { role?: Role; active?: boolean }) => Promise<void>;
  inviteMember: (d: { name: string; email: string; role: Role }) => Promise<{ emailed: boolean; devInviteUrl?: string }>;
  resetPassword: (id: string) => Promise<{ pending: boolean; emailed: boolean; devInviteUrl?: string }>;
  createPlan: (d: PlanInput) => Promise<{ plans: Plan[]; issued: number }>;
  planAction: (id: string, action: "pause" | "resume" | "cancel" | "issue-now") => Promise<{ plan: Plan; issued: number }>;
  runRenewals: () => Promise<{ plansRun: number; codesIssued: number; completed: number }>;
  sendTestEmail: (kind: "code" | "reward" | "recurring") => Promise<string>;
};
const StoreCtx = createContext<Ctx>(null as unknown as Ctx);
export const useStore = () => useContext(StoreCtx);

export const errMsg = (e: unknown) => (e instanceof ApiErr ? e.message : "Something went wrong. Please try again.");

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [d, setD] = useState<Boot | null>(null);

  const refresh = useCallback(async () => {
    try { setD(await api.get<Boot>("/api/staff/bootstrap")); }
    catch (e) { if (e instanceof ApiErr && e.status === 401) setD(null); }
    setReady(true);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // Every mutation hits the server first, then re-syncs. The server is the single source of truth.
  const act = useCallback(async <T,>(p: Promise<T>): Promise<T> => { const r = await p; await refresh(); return r; }, [refresh]);

  const value = useMemo<Ctx>(() => ({
    ready, user: d?.user ?? null,
    codes: d?.codes ?? [], rewards: d?.rewards ?? [], activity: d?.activity ?? [], templates: d?.templates ?? DEFAULT_TEMPLATES, settings: d?.settings ?? DEFAULT_SETTINGS, team: d?.team ?? [], plans: d?.plans ?? [],
    staffNames: (d?.team ?? []).map((m) => m.name), system: d?.system ?? null,
    refresh,
    login: async (email, password) => { await api.post("/api/auth/login", { email, password }); await refresh(); },
    logout: async () => { await api.post("/api/auth/logout"); setD(null); },
    generateCode: (x) => act(api.post("/api/staff/codes", x)),
    sendCode: (id) => act(api.post(`/api/staff/codes/${id}/send`)).then(() => {}),
    cancelCode: (id) => act(api.post(`/api/staff/codes/${id}/cancel`)).then(() => {}),
    fulfil: (id) => act(api.post(`/api/staff/codes/${id}/fulfil`)).then(() => {}),
    updateReward: (id, p) => act(api.patch(`/api/staff/rewards/${id}`, p)).then(() => {}),
    uploadMedia: async (file) => { const fd = new FormData(); fd.append("file", file); const r = await fetch("/api/staff/media", { method: "POST", body: fd, credentials: "same-origin" }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new ApiErr(r.status, j.error ?? "Upload failed", j); return j.url as string; },
    bulkCodes: (ids, action) => act(api.post("/api/staff/codes/bulk", { ids, action })),
    bulkPlans: (ids, action) => act(api.post("/api/staff/plans/bulk", { ids, action })),
    saveLegal: (d) => api.put<{ docs: LegalDoc[] }>("/api/staff/legal", d).then((r) => r.docs),
    resetRewards: () => act(api.post("/api/staff/rewards/reset")).then(() => {}),
    saveTemplates: (t) => act(api.put("/api/staff/templates", t)).then(() => {}),
    saveSettings: (s) => act(api.put("/api/staff/settings", s)).then(() => {}),
    updateMember: (id, p) => act(api.patch(`/api/staff/team/${id}`, p)).then(() => {}),
    inviteMember: (x) => act(api.post<{ emailed: boolean; devInviteUrl?: string }>("/api/staff/team", x)),
    resetPassword: (id) => act(api.post<{ pending: boolean; emailed: boolean; devInviteUrl?: string }>(`/api/staff/team/${id}/reset`)),
    createPlan: (x) => act(api.post("/api/staff/plans", x)),
    planAction: (id, action) => act(api.patch(`/api/staff/plans/${id}`, { action })),
    runRenewals: async () => (await act(api.post<{ summary: { plansRun: number; codesIssued: number; completed: number } }>("/api/staff/plans/run"))).summary,
    sendTestEmail: async (kind) => (await api.post<{ to: string }>("/api/staff/emails/test", { kind })).to,
  }), [ready, d, refresh, act]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
