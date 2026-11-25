import { randomBytes, randomInt } from "node:crypto";
import { and, eq } from "drizzle-orm";
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

export async function createCode(db: Q, o: { name: string; org: string; email: string | null; days: number; by: Issuer; planId?: string; cycleNo?: number; now?: Date }): Promise<CodeRow> {
  const now = o.now ?? new Date();
  for (let i = 0; i < 5; i++) {
    try {
      const [row] = await db.insert(codes).values({
        code: generateCodeString(), recipientName: o.name, organisation: o.org, email: o.email,
        createdBy: o.by.id, createdByName: o.by.name, createdAt: now, expiresAt: new Date(now.getTime() + o.days * 864e5),
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
  const ok = await sendEmail(db, { to: row.email, kind: "code", codeId: row.id, ...codeEmail(t, { name: row.recipientName, code: row.code, expiresAt: row.expiresAt }) });
  if (ok) {
    await db.update(codes).set({ emailedAt: new Date() }).where(eq(codes.id, row.id));
    await logActivity(db, actor, `Emailed code to ${row.email}`, "email");
  }
  return ok;
}

export type RedeemResult =
  | { ok: true; restored: boolean; reward: Reward; ref: string; claimToken?: string; firstName: string; email: string | null; codeId: string; name: string }
  | { ok: false; reason: "invalid" | "used" | "expired" | "cancelled"; expiresAt?: Date };

/**
 * Atomic redemption. The row is locked, the prize is chosen with a CSPRNG, and the code is marked used in the SAME
 * transaction, so refreshes, double-clicks and parallel tabs can never create a second reward.
 * A returning browser that presents its claim token gets the ORIGINAL result back (dropped-connection recovery).
 */
export async function redeemCode(db: DB, input: string, claimToken?: string): Promise<RedeemResult> {
  const formatted = formatCode(input);
  const norm = normaliseCode(input);
  if (norm.length !== 3 + CODE_BODY_LEN || !norm.startsWith("VTH")) return { ok: false, reason: "invalid" };

  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(codes).where(eq(codes.code, formatted)).for("update");
    if (!row) return { ok: false, reason: "invalid" } as const;

    if (row.status === "used") {
      if (claimToken && row.claimHash && sha256(claimToken) === row.claimHash && row.rewardId && row.ref) {
        const [rw] = await tx.select().from(rewards).where(eq(rewards.id, row.rewardId));
        return { ok: true, restored: true, reward: toReward(rw), ref: row.ref, firstName: row.recipientName.split(" ")[0], email: row.email, codeId: row.id, name: row.recipientName } as const;
      }
      return { ok: false, reason: "used" } as const;
    }
    if (row.status === "cancelled") return { ok: false, reason: "cancelled" } as const;
    if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired", expiresAt: row.expiresAt } as const;

    const pool = await tx.select().from(rewards).orderBy(rewards.id);
    if (pool.length === 0) throw new Error("No rewards configured");
    const prize = pool[randomInt(pool.length)];
    const ref = generateRef();
    // The browser generates + stores its claim secret BEFORE the request, so even if the response is lost it can recover.
    const claim = claimToken && /^[A-Za-z0-9_-]{16,100}$/.test(claimToken) ? claimToken : randomBytes(24).toString("base64url");

    const [upd] = await tx.update(codes).set({ status: "used", usedAt: new Date(), rewardId: prize.id, ref, claimHash: sha256(claim), fulfilment: "pending" })
      .where(and(eq(codes.id, row.id), eq(codes.status, "active"))).returning({ id: codes.id });
    if (!upd) return { ok: false, reason: "used" } as const; // lost a race — impossible under row lock, kept as a guard
    await logActivity(tx, row.recipientName, `Spun the wheel and won “${prize.name}”`, "spin");
    return { ok: true, restored: false, reward: toReward(prize), ref, claimToken: claim, firstName: row.recipientName.split(" ")[0], email: row.email, codeId: row.id, name: row.recipientName } as const;
  });
}

export async function emailReward(db: DB, r: Extract<RedeemResult, { ok: true }>) {
  if (!r.email) return;
  const t = await getTemplates(db);
  await sendEmail(db, { to: r.email, kind: "reward", codeId: r.codeId, ...rewardEmail(t, { name: r.name, reward: r.reward.name, ref: r.ref }) });
}

/** Read-only status check used by the landing page before the wheel unlocks. */
export async function checkCode(db: DB, input: string): Promise<{ ok: true; firstName: string } | { ok: false; reason: "invalid" | "used" | "expired" | "cancelled"; expiresAt?: Date }> {
  const norm = normaliseCode(input);
  if (norm.length !== 3 + CODE_BODY_LEN || !norm.startsWith("VTH")) return { ok: false, reason: "invalid" };
  const [row] = await db.select().from(codes).where(eq(codes.code, formatCode(input)));
  if (!row) return { ok: false, reason: "invalid" };
  if (row.status === "used") return { ok: false, reason: "used" };
  if (row.status === "cancelled") return { ok: false, reason: "cancelled" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired", expiresAt: row.expiresAt };
  return { ok: true, firstName: row.recipientName.split(" ")[0] };
}

/** Read-only: return the ORIGINAL result to the browser that holds the claim token (dropped-connection recovery). */
export async function restoreCode(db: DB, input: string, claimToken: string) {
  const norm = normaliseCode(input);
  if (norm.length !== 3 + CODE_BODY_LEN) return null;
  const [row] = await db.select().from(codes).where(eq(codes.code, formatCode(input)));
  if (!row || row.status !== "used" || !row.claimHash || sha256(claimToken) !== row.claimHash || !row.rewardId || !row.ref) return null;
  const [rw] = await db.select().from(rewards).where(eq(rewards.id, row.rewardId));
  return { reward: toReward(rw), ref: row.ref, firstName: row.recipientName.split(" ")[0], email: row.email };
}

export const maskEmail = (e: string | null) => {
  if (!e) return null;
  const [u, d] = e.split("@");
  return `${u[0]}${"*".repeat(Math.max(2, u.length - 1))}@${d}`;
};
