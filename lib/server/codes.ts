import { randomBytes, randomInt } from "node:crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { ALPHABET, CODE_BODY_LEN, formatCode, normaliseCode, type Reward } from "../shared";
import type { DB } from "./db";
import { codeEmail, rewardEmail, sendEmail } from "./email";
import { sha256 } from "./http";
import { codes, rewards, type CodeRow } from "./schema";
import { getTemplates, logActivity } from "./settings";
import { toReward } from "./serialize";

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type Q = DB | Tx;

const pick = (n: number, alphabet = ALPHABET) => Array.from({ length: n }, () => alphabet[randomInt(alphabet.length)]).join("");

/** VTH-XXXX-XXXX-XXXX — 12 random chars from a 31-symbol alphabet (~7.9e17 combinations). No prize info is encoded. */
export function generateCodeString() {
  const b = pick(CODE_BODY_LEN);
  return `VTH-${b.slice(0, 4)}-${b.slice(4, 8)}-${b.slice(8)}`;
}
export const generateRef = () => `REF-${pick(8)}`;

export type Issuer = { id: string | null; name: string };

export async function createCode(db: Q, o: { name: string; org: string; email: string | null; days?: number; expiresAt?: Date; spins?: number; by: Issuer; planId?: string; cycleNo?: number; now?: Date }): Promise<CodeRow> {
  const now = o.now ?? new Date();
  const expiresAt = o.expiresAt ?? new Date(now.getTime() + (o.days ?? 14) * 864e5);
  const spins = o.spins === 2 ? 2 : 1;
  for (let i = 0; i < 5; i++) {
    try {
      const [row] = await db.insert(codes).values({
        code: generateCodeString(), recipientName: o.name, organisation: o.org, email: o.email,
        createdBy: o.by.id, createdByName: o.by.name, createdAt: now, expiresAt, spinsAllowed: spins,
        planId: o.planId, cycleNo: o.cycleNo,
      }).returning();
      return row;
    } catch (e) {
      if (i === 4 || !String((e as Error).message).includes("unique")) throw e; // collision: try another code
    }
  }
  throw new Error("unreachable");
}

/** Email an existing code and stamp emailed_at. Returns false if there's no address or delivery failed. */
export async function emailCode(db: DB, row: CodeRow, actor: string): Promise<boolean> {
  if (!row.email) return false;
  const t = await getTemplates(db);
  const ok = await sendEmail(db, { to: row.email, kind: "code", codeId: row.id, ...codeEmail(t, { name: row.recipientName, code: row.code, expiresAt: row.expiresAt, spins: row.spinsAllowed }) });
  if (ok) {
    await db.update(codes).set({ emailedAt: new Date() }).where(eq(codes.id, row.id));
    await logActivity(db, actor, `Emailed code to ${row.email}`, "email");
  }
  return ok;
}

export type Spin = {
  reward: Reward; ref: string; firstName: string; email: string | null; codeId: string; name: string;
  spinsAllowed: number; spinsUsed: number;
  /** true once the prize can no longer change (accepted, or no spins left) */
  final: boolean;
  /** true while the holder may still spin again (which voids the current prize) */
  canRespin: boolean;
};
export type RedeemFail = { ok: false; reason: "invalid" | "used" | "expired" | "cancelled"; expiresAt?: Date };
export type RedeemResult = ({ ok: true; restored: boolean; claimToken?: string } & Spin) | RedeemFail;

const own = (row: CodeRow, token?: string) => !!token && !!row.claimHash && sha256(token) === row.claimHash;
const isAwaiting = (row: CodeRow) => row.status === "active" && row.spinsUsed > 0 && !row.acceptedAt;

async function spinOf(tx: Q, row: CodeRow): Promise<Spin | null> {
  if (!row.rewardId || !row.ref) return null;
  const [rw] = await tx.select().from(rewards).where(eq(rewards.id, row.rewardId));
  if (!rw) return null;
  const final = row.status === "used";
  return {
    reward: toReward(rw), ref: row.ref, firstName: row.recipientName.split(" ")[0], email: row.email, codeId: row.id, name: row.recipientName,
    spinsAllowed: row.spinsAllowed, spinsUsed: row.spinsUsed, final,
    canRespin: !final && row.spinsUsed < row.spinsAllowed && row.expiresAt.getTime() > Date.now(),
  };
}

/**
 * Atomic redemption. The row is locked, the prize is chosen with a CSPRNG, and the result is recorded in the SAME
 * transaction, so refreshes, double-clicks and parallel tabs can never create a second reward.
 *  - 1-spin code: the spin is final immediately.
 *  - 2-spin code: after the first spin the prize is "awaiting" acceptance; the holder may accept it, or spin again
 *    (`respin`), which VOIDS the first prize and is final.
 * The browser keeps a secret claim token for the code; presenting it recovers the current result after a dropped connection
 * and proves ownership for accept / respin. Anyone else holding the code just sees "already used".
 */
export async function redeemCode(db: DB, input: string, claimToken?: string, respin = false): Promise<RedeemResult> {
  const formatted = formatCode(input);
  const norm = normaliseCode(input);
  if (norm.length !== 3 + CODE_BODY_LEN || !norm.startsWith("VTH")) return { ok: false, reason: "invalid" };

  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(codes).where(eq(codes.code, formatted)).for("update");
    if (!row) return { ok: false, reason: "invalid" } as const;
    if (row.status === "cancelled") return { ok: false, reason: "cancelled" } as const;

    const owner = own(row, claimToken);
    if (row.status === "used" || isAwaiting(row)) {
      if (!owner) return { ok: false, reason: "used" } as const;
      if (isAwaiting(row) && respin && row.spinsUsed < row.spinsAllowed) {
        if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired", expiresAt: row.expiresAt } as const;
        const [old] = row.rewardId ? await tx.select().from(rewards).where(eq(rewards.id, row.rewardId)) : [];
        const pool = await tx.select().from(rewards).orderBy(rewards.id);
        const prize = pool[randomInt(pool.length)];
        const ref = generateRef();
        const voided = [...(row.voided ?? []), { rewardId: row.rewardId ?? 0, name: old?.name ?? "-", ref: row.ref ?? "", at: new Date().toISOString() }];
        const [u] = await tx.update(codes).set({ status: "used", spinsUsed: row.spinsUsed + 1, usedAt: new Date(), acceptedAt: new Date(), rewardId: prize.id, ref, voided, fulfilment: "pending" })
          .where(and(eq(codes.id, row.id), eq(codes.spinsUsed, row.spinsUsed))).returning();
        if (!u) return { ok: false, reason: "used" } as const;
        await logActivity(tx, row.recipientName, `Spun again: earlier prize “${old?.name ?? "-"}” voided; won “${prize.name}” (final)`, "spin");
        return { ok: true, restored: false, ...(await spinOf(tx, u))! } as const;
      }
      const cur = await spinOf(tx, row);
      return cur ? ({ ok: true, restored: true, ...cur } as const) : ({ ok: false, reason: "used" } as const);
    }

    if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired", expiresAt: row.expiresAt } as const;

    const pool = await tx.select().from(rewards).orderBy(rewards.id);
    if (pool.length === 0) throw new Error("No rewards configured");
    const prize = pool[randomInt(pool.length)];
    const ref = generateRef();
    // The browser generates + stores its claim secret BEFORE the request, so even if the response is lost it can recover.
    const claim = claimToken && /^[A-Za-z0-9_-]{16,100}$/.test(claimToken) ? claimToken : randomBytes(24).toString("base64url");
    const oneSpin = row.spinsAllowed <= 1;
    const now = new Date();
    const [upd] = await tx.update(codes).set({
      status: oneSpin ? "used" : "active", spinsUsed: 1, usedAt: now, acceptedAt: oneSpin ? now : null, rewardId: prize.id, ref,
      claimHash: sha256(claim), fulfilment: oneSpin ? "pending" : null,
    }).where(and(eq(codes.id, row.id), eq(codes.spinsUsed, 0), eq(codes.status, "active"))).returning();
    if (!upd) return { ok: false, reason: "used" } as const; // lost a race: impossible under row lock, kept as a guard
    await logActivity(tx, row.recipientName, oneSpin ? `Spun the wheel and won “${prize.name}”` : `Spun the wheel (spin 1 of ${row.spinsAllowed}): “${prize.name}”, awaiting acceptance`, "spin");
    return { ok: true, restored: false, claimToken: claim, ...(await spinOf(tx, upd))! } as const;
  });
}

/** The holder accepts the current prize on a 2-spin code: it becomes final and the staff portal is notified. */
export async function acceptPrize(db: DB, input: string, claimToken: string): Promise<({ ok: true; restored: boolean } & Spin) | RedeemFail> {
  const norm = normaliseCode(input);
  if (norm.length !== 3 + CODE_BODY_LEN || !norm.startsWith("VTH")) return { ok: false, reason: "invalid" };
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(codes).where(eq(codes.code, formatCode(input))).for("update");
    if (!row) return { ok: false, reason: "invalid" } as const;
    if (!own(row, claimToken)) return { ok: false, reason: row.status === "cancelled" ? "cancelled" : "used" } as const;
    if (row.status === "cancelled") return { ok: false, reason: "cancelled" } as const;
    if (row.status === "used") return { ok: true, restored: true, ...(await spinOf(tx, row))! } as const;
    const [u] = await tx.update(codes).set({ status: "used", acceptedAt: new Date(), fulfilment: "pending" })
      .where(and(eq(codes.id, row.id), eq(codes.status, "active"))).returning();
    if (!u) return { ok: false, reason: "used" } as const;
    const s = (await spinOf(tx, u))!;
    await logActivity(tx, row.recipientName, `Accepted the prize “${s.reward.name}” (${s.ref}), ready to action`, "accept");
    return { ok: true, restored: false, ...s } as const;
  });
}

/** Daily job: a prize that was spun but never accepted by the time the code expires simply stands (it is accepted for them). */
export async function autoAcceptExpired(db: DB): Promise<number> {
  const due = await db.select().from(codes).where(and(eq(codes.status, "active"), gt(codes.spinsUsed, 0), isNull(codes.acceptedAt), lt(codes.expiresAt, new Date()))).limit(200);
  let n = 0;
  for (const c of due) {
    const [u] = await db.update(codes).set({ status: "used", acceptedAt: new Date(), fulfilment: "pending" })
      .where(and(eq(codes.id, c.id), eq(codes.status, "active"), isNull(codes.acceptedAt))).returning();
    if (!u) continue;
    const s = await spinOf(db, u);
    if (!s) continue;
    n++;
    await logActivity(db, "System", `Prize “${s.reward.name}” (${s.ref}) for ${u.recipientName} accepted automatically: the code expired`, "accept");
    await emailReward(db, s).catch((e) => console.error("[email] reward", e));
  }
  return n;
}

export async function emailReward(db: DB, r: Pick<Spin, "email" | "codeId" | "name" | "reward" | "ref">) {
  if (!r.email) return;
  const t = await getTemplates(db);
  await sendEmail(db, { to: r.email, kind: "reward", codeId: r.codeId, ...rewardEmail(t, { name: r.name, reward: r.reward.name, ref: r.ref }) });
}

/** Read-only status check used by the landing page before the wheel unlocks. */
export async function checkCode(db: DB, input: string): Promise<{ ok: true; firstName: string; spins: number } | RedeemFail> {
  const norm = normaliseCode(input);
  if (norm.length !== 3 + CODE_BODY_LEN || !norm.startsWith("VTH")) return { ok: false, reason: "invalid" };
  const [row] = await db.select().from(codes).where(eq(codes.code, formatCode(input)));
  if (!row) return { ok: false, reason: "invalid" };
  if (row.status === "used" || isAwaiting(row)) return { ok: false, reason: "used" };
  if (row.status === "cancelled") return { ok: false, reason: "cancelled" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired", expiresAt: row.expiresAt };
  return { ok: true, firstName: row.recipientName.split(" ")[0], spins: row.spinsAllowed };
}

/** Read-only: return the CURRENT result to the browser that holds the claim token (dropped-connection / return visit). */
export async function restoreCode(db: DB, input: string, claimToken: string): Promise<Spin | null> {
  const norm = normaliseCode(input);
  if (norm.length !== 3 + CODE_BODY_LEN) return null;
  const [row] = await db.select().from(codes).where(eq(codes.code, formatCode(input)));
  if (!row || row.status === "cancelled" || !own(row, claimToken) || (row.status !== "used" && !isAwaiting(row))) return null;
  return spinOf(db, row);
}

export const maskEmail = (e: string | null) => {
  if (!e) return null;
  const [u, d] = e.split("@");
  return `${u[0]}${"*".repeat(Math.max(2, u.length - 1))}@${d}`;
};
