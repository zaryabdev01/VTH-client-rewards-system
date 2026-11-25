import { renderTpl, type Templates } from "../shared";
import type { DB } from "./db";
import { emailLog } from "./schema";

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const FROM = () => process.env.EMAIL_FROM ?? "VTH Rewards <rewards@vth.co.uk>";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const paras = (t: string) => t.split(/\n\n+/).map((p) => `<p style="margin:0 0 16px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
const dateLong = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

type Built = { subject: string; html: string; text: string };

/** Table-based, inline-styled layout that renders in Outlook/Gmail/Apple Mail. */
function layout(inner: string, preheader: string, signOff: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>VTH</title></head>
<body style="margin:0;padding:0;background:#eceef3;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#2b2d3f">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eceef3"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#131318;padding:26px;text-align:center"><span style="font-size:22px;font-weight:700;letter-spacing:.08em;color:#f1ede3">VTH</span><br><span style="font-size:10px;letter-spacing:.3em;color:#c9a96a">REWARDS</span></td></tr>
<tr><td style="padding:30px 30px 8px;font-size:15px;line-height:1.65">${inner}<p style="margin:22px 0 0">${esc(signOff).replace(/\n/g, "<br>")}</p></td></tr>
<tr><td style="padding:22px 30px 26px;font-size:12px;color:#8a8ca3;text-align:center">VTH · Sent from rewards@vth.co.uk</td></tr>
</table></td></tr></table></body></html>`;
}
const button = (href: string, label: string) =>
  `<p style="text-align:center;margin:8px 0 20px"><a href="${esc(href)}" style="display:inline-block;background:#17171c;color:#f1ede3;text-decoration:none;font-weight:600;padding:14px 30px;border-radius:10px">${esc(label)}</a></p>`;
const codeBox = (code: string) =>
  `<div style="margin:12px 0;padding:18px;text-align:center;border-radius:12px;background:#faf7f0;border:1.5px dashed #c9a96a;font-family:Consolas,Menlo,monospace;font-size:24px;font-weight:700;letter-spacing:.12em;color:#3b2f17">${esc(code)}</div>`;

export function codeEmail(t: Templates, v: { name: string; code: string; expiresAt: Date }): Built {
  const vars = { name: v.name.split(" ")[0], expiry: dateLong(v.expiresAt) };
  const [first, ...rest] = renderTpl(t.codeBody, vars).split(/\n\n+/);
  const url = `${appUrl()}/?code=${encodeURIComponent(v.code)}`;
  const html = layout(`${paras(first)}${rest.length ? paras(rest.slice(0, 1).join("\n\n")) : ""}${codeBox(v.code)}${button(url, "Unlock My Spin")}${paras(rest.slice(1).join("\n\n"))}`, "Your personal spin code is inside", t.signOff);
  return { subject: renderTpl(t.codeSubject, vars), html, text: `${renderTpl(t.codeBody, vars)}\n\nYour code: ${v.code}\nSpin here: ${url}\n\n${t.signOff}` };
}

export function recurringEmail(t: Templates, v: { name: string; codes: string[]; expiresAt: Date }): Built {
  const n = v.codes.length;
  const vars = { name: v.name.split(" ")[0], expiry: dateLong(v.expiresAt), count: n === 1 ? "is your fresh code" : `are your ${n} fresh codes` };
  const [first, ...rest] = renderTpl(t.recurringBody, vars).split(/\n\n+/);
  const url = `${appUrl()}/?code=${encodeURIComponent(v.codes[0])}`;
  const html = layout(`${paras(first)}${paras(rest.slice(0, 1).join("\n\n"))}${v.codes.map(codeBox).join("")}${button(url, "Unlock My Spin")}${paras(rest.slice(1).join("\n\n"))}`, "Your next spin is ready", t.signOff);
  return { subject: renderTpl(t.recurringSubject, vars), html, text: `${renderTpl(t.recurringBody, vars)}\n\n${v.codes.join("\n")}\nSpin here: ${url}\n\n${t.signOff}` };
}

export function rewardEmail(t: Templates, v: { name: string; reward: string; ref: string }): Built {
  const vars = { name: v.name.split(" ")[0], reward: v.reward, ref: v.ref };
  const [first, ...rest] = renderTpl(t.rewardBody, vars).split(/\n\n+/);
  const box = `<div style="margin:14px 0;padding:18px;text-align:center;border-radius:12px;background:#faf6ec;border:1px solid #eadfc2;color:#4a3a14"><div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:600;color:#9a7b3f">Your reward</div><div style="font-size:21px;font-weight:600;margin-top:4px">${esc(v.reward)}</div><div style="font-family:Consolas,Menlo,monospace;margin-top:6px;font-size:13px">${esc(v.ref)}</div></div>`;
  const html = layout(`<h2 style="margin:0 0 14px;font-size:22px;color:#12154a">${esc(first)}</h2>${box}${paras(rest.join("\n\n"))}`, `You won ${v.reward}`, t.signOff);
  return { subject: renderTpl(t.rewardSubject, vars), html, text: `${renderTpl(t.rewardBody, vars)}\n\nReference: ${v.ref}\n\n${t.signOff}` };
}

export function inviteEmail(v: { name: string; inviter: string; url: string; reset?: boolean }): Built {
  const msg = v.reset
    ? `${v.inviter} sent you a link to choose a new password for the VTH Rewards staff portal. It expires in 72 hours. If you weren't expecting this you can ignore it — your current password still works.`
    : `${v.inviter} has invited you to the VTH Rewards staff portal. Set your password to get started. This link expires in 72 hours.`;
  const html = layout(`${paras(`Hi ${v.name.split(" ")[0]},\n\n${msg}`)}${button(v.url, "Set my password")}`, v.reset ? "Reset your password" : "You've been invited to VTH Rewards", "The VTH Team");
  return { subject: v.reset ? "Reset your VTH Rewards password" : "You're invited to the VTH Rewards portal", html, text: `${msg} ${v.url}` };
}

export async function sendEmail(db: DB, o: { to: string; kind: string; codeId?: string } & Built): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  let status: "sent" | "failed" | "logged" = "logged"; let providerId: string | undefined; let error: string | undefined;
  if (!key) {
    console.log(`\n[email:dev] to=${o.to} kind=${o.kind}\n  subject: ${o.subject}\n  ${o.text.split("\n").join("\n  ")}\n`);
  } else {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM(), to: [o.to], subject: o.subject, html: o.html, text: o.text, reply_to: process.env.EMAIL_REPLY_TO || undefined }),
      });
      const j = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (res.ok) { status = "sent"; providerId = j.id; } else { status = "failed"; error = j.message ?? `HTTP ${res.status}`; }
    } catch (e) { status = "failed"; error = e instanceof Error ? e.message : "network error"; }
  }
  await db.insert(emailLog).values({ toEmail: o.to, subject: o.subject, kind: o.kind, status, providerId, error, codeId: o.codeId }).catch(() => {});
  return status !== "failed";
}
