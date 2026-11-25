/* Shared (client + server) types, constants and pure helpers. No "use client" / server-only imports here. */

export type IconKey =
  | "coins" | "user" | "percent" | "zap" | "gem" | "arrowUp" | "users" | "sparkles" | "video" | "award" | "crown" | "armchair";

export type Reward = { id: number; label: string; name: string; desc: string; icon: IconKey };
export type CodeStatus = "active" | "used" | "expired" | "cancelled";
export type Code = {
  id: string; code: string; name: string; org: string; email: string; createdBy: string;
  createdAt: string; expiresAt: string; status: "active" | "used" | "cancelled"; emailedAt?: string;
  usedAt?: string; rewardId?: number; ref?: string; fulfilment?: "pending" | "fulfilled";
  planId?: string; cycleNo?: number;
};
export type Activity = { id: string; at: string; who: string; text: string; kind: "code" | "email" | "spin" | "reward" | "fulfil" | "plan" };
export type Role = "admin" | "standard";
export type User = { id: string; name: string; email: string; role: Role; initials: string };
export type Member = { id: string; name: string; email: string; role: Role; active: boolean; lastActive: string | null; invited?: boolean };

export type Frequency = "weekly" | "fortnightly" | "monthly";
export type PlanStatus = "active" | "paused" | "cancelled" | "completed";
export type Plan = {
  id: string; name: string; org: string; email: string; frequency: Frequency; spinsPerCycle: number; codeValidityDays: number;
  startsAt: string; nextRunAt: string; endsAt?: string; maxCycles?: number; cyclesDone: number; status: PlanStatus;
  lastRunAt?: string; createdBy: string; createdAt: string;
};

export type Templates = {
  codeSubject: string; codeBody: string; rewardSubject: string; rewardBody: string;
  recurringSubject: string; recurringBody: string; signOff: string;
};
export type Settings = { defaultExpiry: number; staffCanChangeExpiry: boolean };

export const DEFAULT_REWARDS: Reward[] = [
  { id: 1, label: "£10 Learning|Credit", name: "£10 Learning Credit", desc: "£10 credited towards any VTH course or session.", icon: "coins" },
  { id: 2, label: "Free 1:1|Coaching", name: "Free 1:1 Coaching Session", desc: "A complimentary 45-minute one-to-one coaching call.", icon: "user" },
  { id: 3, label: "5% Off|Next Course", name: "5% Off Your Next Course", desc: "5% discount applied to your next course booking.", icon: "percent" },
  { id: 4, label: "Priority|Booking", name: "Priority Booking", desc: "First access to new cohort dates for the next 6 months.", icon: "zap" },
  { id: 5, label: "£25 Learning|Credit", name: "£25 Learning Credit", desc: "£25 credited towards any VTH course or session.", icon: "gem" },
  { id: 6, label: "Free Course|Upgrade", name: "Free Course Upgrade", desc: "Upgrade your next course to the premium tier at no cost.", icon: "arrowUp" },
  { id: 7, label: "Face-to-Face|Session", name: "Free Face-to-Face Session", desc: "A complimentary in-person session with a VTH specialist.", icon: "users" },
  { id: 8, label: "Bonus|Credits", name: "Bonus Learning Credits", desc: "Surprise bonus credits added to your VTH account.", icon: "sparkles" },
  { id: 9, label: "Webinar|VIP Pass", name: "Webinar VIP Pass", desc: "VIP access to VTH's next live expert webinar.", icon: "video" },
  { id: 10, label: "Free|Certificate", name: "Free Certificate Print", desc: "A framed, printed certificate for your next completion.", icon: "award" },
  { id: 11, label: "£50 Learning|Credit", name: "£50 Learning Credit", desc: "£50 credited towards any VTH course or session.", icon: "crown" },
  { id: 12, label: "Extra|Course Seat", name: "Extra Course Seat", desc: "One additional seat on your next team booking.", icon: "armchair" },
];

export const DEFAULT_TEMPLATES: Templates = {
  codeSubject: "Your VTH thank-you spin code",
  codeBody: "Hi {{name}},\n\nThank you for speaking with us today. As a thank-you for being a valued VTH client, here is your personal code to spin our reward wheel.\n\nYour code expires on {{expiry}}. One spin per code, and every section on the wheel is a prize.",
  rewardSubject: "Your reward is confirmed – {{ref}}",
  rewardBody: "Congratulations, {{name}}!\n\nYou spun the wheel and won {{reward}}. Your reward has been recorded against reference {{ref}}.\n\nTo claim it, reply to this email or quote your reference number to your VTH contact. We will arrange your reward within 5 working days.",
  recurringSubject: "Your new VTH spin is ready",
  recurringBody: "Hi {{name}},\n\nGood news – your next thank-you spin from VTH is ready. Below {{count}}.\n\nYour code expires on {{expiry}}. One spin per code, and every section on the wheel is a prize.",
  signOff: "Warm regards,\nThe VTH Team",
};
export const DEFAULT_SETTINGS: Settings = { defaultExpiry: 14, staffCanChangeExpiry: true };

export const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
export const CODE_BODY_LEN = 12; // VTH-XXXX-XXXX-XXXX

export const normaliseCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const formatCode = (s: string) => {
  const n = normaliseCode(s);
  return n.length === 3 + CODE_BODY_LEN && n.startsWith("VTH") ? `VTH-${n.slice(3, 7)}-${n.slice(7, 11)}-${n.slice(11)}` : s;
};
export const renderTpl = (t: string, v: Record<string, string>) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => v[k] ?? `{{${k}}}`);

export const effectiveStatus = (c: { status: Code["status"]; expiresAt: string }): CodeStatus =>
  c.status === "active" && new Date(c.expiresAt).getTime() < Date.now() ? "expired" : c.status;

export const FREQ_LABEL: Record<Frequency, string> = { weekly: "Every week", fortnightly: "Every 2 weeks", monthly: "Every month" };

/* ---------- Formatters ---------- */
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
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
