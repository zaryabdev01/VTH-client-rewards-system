"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/* ---------- Types ---------- */
export type IconKey =
  | "coins" | "user" | "percent" | "zap" | "gem" | "arrowUp" | "users" | "sparkles" | "video" | "award" | "crown" | "armchair";

export type Reward = { id: number; label: string; name: string; desc: string; icon: IconKey; enabled: boolean };
export type CodeStatus = "active" | "used" | "expired" | "cancelled";
export type Code = {
  id: string; code: string; name: string; org: string; email: string; createdBy: string;
  createdAt: string; expiresAt: string; status: CodeStatus; emailedAt?: string;
  usedAt?: string; rewardId?: number; ref?: string; fulfilment?: "pending" | "fulfilled";
};
export type Activity = { id: string; at: string; who: string; text: string; kind: "code" | "email" | "spin" | "reward" | "fulfil" };
export type Role = "admin" | "standard";
export type User = { name: string; email: string; role: Role; initials: string };

export const STAFF = ["Olivia Hart", "James Whitfield", "Priya Nair", "Daniel Cole"];

export type Templates = { codeSubject: string; codeBody: string; rewardSubject: string; rewardBody: string; signOff: string };
export type Settings = { defaultExpiry: number; staffCanChangeExpiry: boolean };
export type Member = { id: string; name: string; email: string; role: Role; active: boolean; lastActive: string; invited?: boolean };

export const DEFAULT_TEMPLATES: Templates = {
  codeSubject: "Your VTH thank-you spin code",
  codeBody: "Hi {{name}},\n\nThank you for speaking with us today. As a thank-you for being a valued VTH client, here is your personal code to spin our reward wheel.\n\nYour code expires on {{expiry}}. One spin per code, and every section on the wheel is a prize.",
  rewardSubject: "Your reward is confirmed – {{ref}}",
  rewardBody: "Congratulations, {{name}}!\n\nYou spun the wheel and won {{reward}}. Your reward has been recorded against reference {{ref}}.\n\nTo claim it, reply to this email or quote your reference number to your VTH contact. We will arrange your reward within 5 working days.",
  signOff: "Warm regards,\nThe VTH Team",
};
export const DEFAULT_SETTINGS: Settings = { defaultExpiry: 14, staffCanChangeExpiry: true };
export const renderTpl = (t: string, v: Record<string, string>) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => v[k] ?? `{{${k}}}`);

const seedTeam = (): Member[] => {
  const now = Date.now();
  return [
    { id: "m1", name: "Olivia Hart", email: "olivia.hart@vth.co.uk", role: "admin", active: true, lastActive: new Date(now - 6e5).toISOString() },
    { id: "m2", name: "James Whitfield", email: "james.whitfield@vth.co.uk", role: "standard", active: true, lastActive: new Date(now - 3 * 36e5).toISOString() },
    { id: "m3", name: "Priya Nair", email: "priya.nair@vth.co.uk", role: "standard", active: true, lastActive: new Date(now - 26 * 36e5).toISOString() },
    { id: "m4", name: "Daniel Cole", email: "daniel.cole@vth.co.uk", role: "standard", active: false, lastActive: new Date(now - 9 * 864e5).toISOString() },
  ];
};

export const DEFAULT_REWARDS: Reward[] = [
  { id: 1, label: "£10 Learning|Credit", name: "£10 Learning Credit", desc: "£10 credited towards any VTH course or session.", icon: "coins", enabled: true },
  { id: 2, label: "Free 1:1|Coaching", name: "Free 1:1 Coaching Session", desc: "A complimentary 45-minute one-to-one coaching call.", icon: "user", enabled: true },
  { id: 3, label: "5% Off|Next Course", name: "5% Off Your Next Course", desc: "5% discount applied to your next course booking.", icon: "percent", enabled: true },
  { id: 4, label: "Priority|Booking", name: "Priority Booking", desc: "First access to new cohort dates for the next 6 months.", icon: "zap", enabled: true },
  { id: 5, label: "£25 Learning|Credit", name: "£25 Learning Credit", desc: "£25 credited towards any VTH course or session.", icon: "gem", enabled: true },
  { id: 6, label: "Free Course|Upgrade", name: "Free Course Upgrade", desc: "Upgrade your next course to the premium tier at no cost.", icon: "arrowUp", enabled: true },
  { id: 7, label: "Face-to-Face|Session", name: "Free Face-to-Face Session", desc: "A complimentary in-person session with a VTH specialist.", icon: "users", enabled: true },
  { id: 8, label: "Bonus|Credits", name: "Bonus Learning Credits", desc: "Surprise bonus credits added to your VTH account.", icon: "sparkles", enabled: true },
  { id: 9, label: "Webinar|VIP Pass", name: "Webinar VIP Pass", desc: "VIP access to VTH's next live expert webinar.", icon: "video", enabled: true },
  { id: 10, label: "Free|Certificate", name: "Free Certificate Print", desc: "A framed, printed certificate for your next completion.", icon: "award", enabled: true },
  { id: 11, label: "£50 Learning|Credit", name: "£50 Learning Credit", desc: "£50 credited towards any VTH course or session.", icon: "crown", enabled: true },
  { id: 12, label: "Extra|Course Seat", name: "Extra Course Seat", desc: "One additional seat on your next team booking.", icon: "armchair", enabled: true },
];

/* ---------- Helpers ---------- */
const KEY = "vth-proto-v5";
const DAY = 86400000;
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const normaliseCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const formatCode = (s: string) => {
  const n = normaliseCode(s);
  return n.length === 11 && n.startsWith("VTH") ? `VTH-${n.slice(3, 7)}-${n.slice(7)}` : s;
};
const randomCode = () => {
  const pick = () => Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
  return `VTH-${pick()}-${pick()}`;
};
const randomRef = () => `REF-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(Math.random() * 9000 + 1000)}`;
const uid = () => Math.random().toString(36).slice(2, 10);

export const effectiveStatus = (c: Code): CodeStatus =>
  c.status === "active" && new Date(c.expiresAt).getTime() < Date.now() ? "expired" : c.status;

/* ---------- Seed ---------- */
function seed(): { codes: Code[]; activity: Activity[] } {
  const now = Date.now();
  const people: [string, string][] = [
    ["Sarah Mitchell", "Brightwave Ltd"], ["Tom Ashworth", "Northgate Logistics"], ["Amira Khan", "Halcyon Health"],
    ["Ben Fraser", "Fraser & Co"], ["Chloe Bennett", "Lumen Digital"], ["Mark Ellison", "Riverside Council"],
    ["Hannah Price", "Kestrel Energy"], ["Rahul Sharma", "Apex Dental Group"], ["Laura Jenkins", "Oakfield Academy"],
    ["Peter Nowak", "Sterling Builders"], ["Grace Okafor", "Meridian Care"], ["Callum Reid", "Highland Foods"],
    ["Zoe Turner", "Pixel & Pine"], ["Imran Ali", "Crescent Pharmacy"], ["Emily Walsh", "Walsh Architects"],
    ["Oscar Bell", "Tidewater Marine"], ["Nina Petrova", "Kinetic Fitness"], ["Harry Dixon", "Dixon Legal"],
    ["Aisha Rahman", "Bloom Nurseries"], ["George Palmer", "Palmer Motors"], ["Isla Murray", "Thistle Hotels"],
    ["Jack Holloway", "Holloway Print"], ["Freya Lowe", "Lowe & Sons"], ["Noah Carter", "Carter Cloud"],
  ];
  const codes: Code[] = [];
  const activity: Activity[] = [];
  const fixed = ["VTH-7K2M-9QXA", "VTH-EXPD-4821", "VTH-USED-0000"];
  people.forEach(([name, org], i) => {
    const created = now - (i * 1.12 + 0.2) * DAY;
    const staff = STAFF[i % STAFF.length];
    const email = `${name.split(" ")[0].toLowerCase()}@${org.toLowerCase().replace(/[^a-z]/g, "")}.co.uk`;
    let status: CodeStatus = "active";
    let extra: Partial<Code> = {};
    const pattern = i % 6;
    const activeExpiry = new Date(now + (((i * 3) % 12) + 3) * DAY).toISOString();
    if (i === 0) status = "active";
    if (i === 5) extra.expiresAt = new Date(now + 30 * 36e5).toISOString();
    else if (i === 1) { status = "active"; extra.expiresAt = new Date(now - 2 * DAY).toISOString(); }
    else if (i === 2) { status = "used"; }
    else if (pattern === 1 || pattern === 4) status = "used";
    else if (pattern === 3 && i > 8) status = "cancelled";
    const code = fixed[i] ?? randomCode();
    const c: Code = {
      id: uid(), code, name, org, email, createdBy: staff, createdAt: new Date(created).toISOString(),
      expiresAt: new Date(created + 14 * DAY).toISOString(), status, emailedAt: i % 7 === 5 ? undefined : new Date(created + 6e5).toISOString(), ...extra,
    };
    if (status === "used") {
      const rid = ((i * 5) % 12) + 1;
      c.rewardId = rid; c.usedAt = new Date(created + (0.1 + (i % 3) * 0.2) * DAY).toISOString();
      c.ref = `REF-${(7000 + i * 137).toString(36).toUpperCase()}${1000 + i * 31}`;
      c.fulfilment = i % 2 === 1 || i === 2 ? "fulfilled" : "pending";
    }
    if (c.status === "active" && !extra.expiresAt) c.expiresAt = activeExpiry;
    codes.push(c);
  });
  codes.slice(0, 10).forEach((c, i) => {
    activity.push({ id: uid(), at: c.createdAt, who: c.createdBy, text: `Generated a code for ${c.name} (${c.org})`, kind: "code" });
    if (c.status === "used") activity.push({ id: uid(), at: c.usedAt!, who: c.name, text: `Spun the wheel and won a reward`, kind: "spin" });
    if (c.emailedAt) activity.push({ id: uid(), at: c.emailedAt, who: c.createdBy, text: `Emailed code to ${c.email}`, kind: "email" });
  });
  activity.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  return { codes, activity };
}

/* ---------- Context ---------- */
type Lookup =
  | { ok: true; code: Code }
  | { ok: false; reason: "invalid" | "used" | "expired" | "cancelled"; code?: Code };

type Ctx = {
  ready: boolean;
  codes: Code[]; rewards: Reward[]; activity: Activity[]; user: User | null;
  login: (role: Role) => void; logout: () => void;
  generateCode: (d: { name: string; org: string; email: string; days: number }) => Code;
  sendCode: (id: string, known?: Code) => void; cancelCode: (id: string) => void; fulfil: (id: string) => void;
  updateReward: (id: number, patch: Partial<Reward>) => void;
  lookup: (input: string) => Lookup;
  redeem: (id: string) => { code: Code; reward: Reward };
  restoreFor: (input: string) => { code: Code; reward: Reward } | null;
  resetDemo: () => void;
  templates: Templates; settings: Settings; team: Member[];
  updateTemplates: (p: Partial<Templates>) => void; updateSettings: (p: Partial<Settings>) => void;
  updateMember: (id: string, p: Partial<Member>) => void; inviteMember: (d: { name: string; email: string; role: Role }) => void;
  resetRewards: () => void;
};
const StoreCtx = createContext<Ctx>(null as unknown as Ctx);
export const useStore = () => useContext(StoreCtx);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [codes, setCodes] = useState<Code[]>([]);
  const [rewards, setRewards] = useState<Reward[]>(DEFAULT_REWARDS);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [mine, setMine] = useState<string[]>([]); // codes redeemed in this browser
  const [templates, setTemplates] = useState<Templates>(DEFAULT_TEMPLATES);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [team, setTeam] = useState<Member[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        setCodes(d.codes); setRewards(d.rewards); setActivity(d.activity); setUser(d.user ?? null); setMine(d.mine ?? []);
        setTemplates(d.templates ?? DEFAULT_TEMPLATES); setSettings(d.settings ?? DEFAULT_SETTINGS); setTeam(d.team ?? seedTeam());
        setReady(true); return;
      }
    } catch {}
    const s = seed(); setCodes(s.codes); setActivity(s.activity); setTeam(seedTeam()); setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify({ codes, rewards, activity, user, mine, templates, settings, team })); } catch {}
  }, [ready, codes, rewards, activity, user, mine, templates, settings, team]);

  const log = useCallback((who: string, text: string, kind: Activity["kind"]) =>
    setActivity((a) => [{ id: uid(), at: new Date().toISOString(), who, text, kind }, ...a].slice(0, 60)), []);

  const login = (role: Role) =>
    setUser(role === "admin"
      ? { name: "Olivia Hart", email: "olivia.hart@vth.co.uk", role, initials: "OH" }
      : { name: "James Whitfield", email: "james.whitfield@vth.co.uk", role, initials: "JW" });
  const logout = () => setUser(null);

  const generateCode: Ctx["generateCode"] = ({ name, org, email, days }) => {
    const now = Date.now();
    const c: Code = {
      id: uid(), code: randomCode(), name, org, email, createdBy: user?.name ?? "Staff",
      createdAt: new Date(now).toISOString(), expiresAt: new Date(now + days * DAY).toISOString(), status: "active",
    };
    setCodes((cs) => [c, ...cs]);
    log(c.createdBy, `Generated a code for ${name}${org ? ` (${org})` : ""}`, "code");
    return c;
  };
  const sendCode = (id: string, known?: Code) => {
    const c = known ?? codes.find((x) => x.id === id); if (!c) return;
    setCodes((cs) => cs.map((x) => (x.id === id ? { ...x, emailedAt: new Date().toISOString() } : x)));
    log(user?.name ?? "Staff", `Emailed code to ${c.email || c.name}`, "email");
  };
  const cancelCode = (id: string) => {
    const c = codes.find((x) => x.id === id); if (!c) return;
    setCodes((cs) => cs.map((x) => (x.id === id ? { ...x, status: "cancelled" } : x)));
    log(user?.name ?? "Staff", `Cancelled code ${c.code}`, "code");
  };
  const fulfil = (id: string) => {
    const c = codes.find((x) => x.id === id); if (!c) return;
    setCodes((cs) => cs.map((x) => (x.id === id ? { ...x, fulfilment: "fulfilled" } : x)));
    log(user?.name ?? "Staff", `Marked reward fulfilled for ${c.name}`, "fulfil");
  };
  const updateReward = (id: number, patch: Partial<Reward>) => {
    setRewards((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    log(user?.name ?? "Staff", `Edited reward section ${id}`, "reward");
  };

  const updateTemplates = (p: Partial<Templates>) => { setTemplates((t) => ({ ...t, ...p })); log(user?.name ?? "Staff", "Updated email templates", "reward"); };
  const updateSettings = (p: Partial<Settings>) => { setSettings((x) => ({ ...x, ...p })); log(user?.name ?? "Staff", "Changed portal settings", "reward"); };
  const updateMember = (id: string, p: Partial<Member>) => {
    const m = team.find((x) => x.id === id); if (!m) return;
    setTeam((t) => t.map((x) => (x.id === id ? { ...x, ...p } : x)));
    log(user?.name ?? "Staff", p.role ? `Changed ${m.name} to ${p.role}` : `${p.active ? "Re-activated" : "Deactivated"} ${m.name}`, "reward");
  };
  const inviteMember = (d: { name: string; email: string; role: Role }) => {
    setTeam((t) => [...t, { id: uid(), ...d, active: true, invited: true, lastActive: new Date().toISOString() }]);
    log(user?.name ?? "Staff", `Invited ${d.name} as ${d.role}`, "reward");
  };
  const resetRewards = () => { setRewards(DEFAULT_REWARDS); log(user?.name ?? "Staff", "Reset all reward sections to defaults", "reward"); };

  const lookup: Ctx["lookup"] = (input) => {
    const n = normaliseCode(input);
    const code = codes.find((c) => normaliseCode(c.code) === n);
    if (!code) return { ok: false, reason: "invalid" };
    const st = effectiveStatus(code);
    if (st === "active") return { ok: true, code };
    return { ok: false, reason: st, code };
  };

  const redeem: Ctx["redeem"] = (id) => {
    // Server-side pick: secure random across enabled equal sections. Done once, atomically.
    const pool = rewards;
    const buf = new Uint32Array(1); crypto.getRandomValues(buf);
    const reward = pool[buf[0] % pool.length];
    const ref = randomRef();
    const target = codes.find((c) => c.id === id)!;
    const updated: Code = { ...target, status: "used", usedAt: new Date().toISOString(), rewardId: reward.id, ref, fulfilment: "pending" };
    setCodes((cs) => cs.map((c) => (c.id === id ? updated : c)));
    setMine((m) => [...m, id]);
    log(target.name, `Spun the wheel and won “${reward.name}”`, "spin");
    return { code: updated, reward };
  };

  const restoreFor: Ctx["restoreFor"] = (input) => {
    const n = normaliseCode(input);
    const code = codes.find((c) => normaliseCode(c.code) === n && c.status === "used" && mine.includes(c.id));
    if (!code) return null;
    const reward = rewards.find((r) => r.id === code.rewardId);
    return reward ? { code, reward } : null;
  };

  const resetDemo = () => {
    const s = seed(); setCodes(s.codes); setActivity(s.activity); setRewards(DEFAULT_REWARDS); setMine([]); setTemplates(DEFAULT_TEMPLATES); setSettings(DEFAULT_SETTINGS); setTeam(seedTeam());
  };

  const value = useMemo<Ctx>(
    () => ({ ready, codes, rewards, activity, user, login, logout, generateCode, sendCode, cancelCode, fulfil, updateReward, lookup, redeem, restoreFor, resetDemo, templates, settings, team, updateTemplates, updateSettings, updateMember, inviteMember, resetRewards }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, codes, rewards, activity, user, mine, templates, settings, team]
  );
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

/* ---------- Formatters ---------- */
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const timeAgo = (iso: string) => {
  const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60) || 1}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const fmtRelative = (iso: string) => {
  const d = new Date(iso).getTime() - Date.now(); const abs = Math.abs(d);
  const m = Math.round(abs / 6e4), h = Math.round(abs / 36e5), dd = Math.round(abs / 864e5);
  const t = abs < 36e5 ? `${m}m` : abs < 864e5 ? `${h}h` : `${dd}d`;
  return d >= 0 ? `in ${t}` : `${t} ago`;
};
