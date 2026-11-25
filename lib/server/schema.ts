import { index, integer, jsonb, pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/* ---------- Staff ---------- */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"), // null until an invited user accepts
  role: text("role").$type<"admin" | "standard">().notNull().default("standard"),
  active: boolean("active").notNull().default(true),
  inviteTokenHash: text("invite_token_hash"),
  inviteExpiresAt: ts("invite_expires_at"),
  invitedAt: ts("invited_at"),
  lastActiveAt: ts("last_active_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

/* ---------- Wheel ---------- */
export const rewards = pgTable("rewards", {
  id: integer("id").primaryKey(), // 1..12 = wheel position
  label: text("label").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  mediaType: text("media_type").$type<"image" | "video">(), // optional picture/video shown in the prize pop-up
  mediaUrl: text("media_url"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/* ---------- Uploaded files (prize images, legal PDFs). Small, stored in Postgres so there is nothing else to host. ---------- */
export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  mime: text("mime").notNull(),
  name: text("name").notNull().default(""),
  size: integer("size").notNull(),
  data: text("data").notNull(), // base64
  createdAt: ts("created_at").notNull().defaultNow(),
});

/* ---------- Recurring plans (option 2: fresh code each period) ---------- */
export const recurringPlans = pgTable("recurring_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipientName: text("recipient_name").notNull(),
  organisation: text("organisation").notNull().default(""),
  email: text("email").notNull(),
  frequency: text("frequency").$type<"daily" | "weekly" | "fortnightly" | "monthly" | "yearly">().notNull(),
  spinsPerCycle: integer("spins_per_cycle").notNull().default(1), // spins on the ONE fresh code issued each cycle (1 or 2)
  codeValidityDays: integer("code_validity_days").notNull().default(14),
  expireAtNext: boolean("expire_at_next").notNull().default(true), // unused code expires when the next allocation is due
  startsAt: ts("starts_at").notNull(),
  nextRunAt: ts("next_run_at").notNull(),
  endsAt: ts("ends_at"),
  maxCycles: integer("max_cycles"),
  cyclesDone: integer("cycles_done").notNull().default(0),
  status: text("status").$type<"active" | "paused" | "cancelled" | "completed">().notNull().default("active"),
  lastRunAt: ts("last_run_at"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdByName: text("created_by_name").notNull().default("System"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("plans_due_idx").on(t.status, t.nextRunAt)]);

/* ---------- Codes ---------- */
export const codes = pgTable("codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(), // VTH-XXXX-XXXX-XXXX
  recipientName: text("recipient_name").notNull(),
  organisation: text("organisation").notNull().default(""),
  email: text("email"),
  status: text("status").$type<"active" | "used" | "cancelled">().notNull().default("active"), // "expired" is derived
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdByName: text("created_by_name").notNull().default("System"),
  createdAt: ts("created_at").notNull().defaultNow(),
  expiresAt: ts("expires_at").notNull(),
  emailedAt: ts("emailed_at"),
  // redemption (set atomically with status -> used)
  usedAt: ts("used_at"),
  rewardId: integer("reward_id").references(() => rewards.id),
  ref: text("ref").unique(),
  claimHash: text("claim_hash"), // lets the same browser restore its result after a dropped connection
  fulfilment: text("fulfilment").$type<"pending" | "fulfilled">(),
  fulfilledAt: ts("fulfilled_at"),
  fulfilledByName: text("fulfilled_by_name"),
  // spins: a 2-spin code lets the holder spin again, which voids the first prize; the prize must be ACCEPTED to be final
  spinsAllowed: integer("spins_allowed").notNull().default(1),
  spinsUsed: integer("spins_used").notNull().default(0),
  acceptedAt: ts("accepted_at"),
  voided: jsonb("voided").$type<{ rewardId: number; name: string; ref: string; at: string }[]>().notNull().default([]),
  // recurring series
  planId: uuid("plan_id").references(() => recurringPlans.id, { onDelete: "set null" }),
  cycleNo: integer("cycle_no"),
}, (t) => [index("codes_status_idx").on(t.status), index("codes_created_idx").on(t.createdAt), index("codes_plan_idx").on(t.planId)]);

/* ---------- Audit, settings, email, limits ---------- */
export const activity = pgTable("activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  at: ts("at").notNull().defaultNow(),
  actorName: text("actor_name").notNull(),
  actorId: uuid("actor_id"),
  text: text("text").notNull(),
  kind: text("kind").$type<"code" | "email" | "spin" | "reward" | "fulfil" | "plan" | "accept">().notNull(),
}, (t) => [index("activity_at_idx").on(t.at)]);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export const emailLog = pgTable("email_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  at: ts("at").notNull().defaultNow(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  kind: text("kind").notNull(),
  status: text("status").$type<"sent" | "failed" | "logged">().notNull(),
  providerId: text("provider_id"),
  error: text("error"),
  codeId: uuid("code_id"),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: ts("window_start").notNull().defaultNow(),
  lockedUntil: ts("locked_until"),
});

export type User = typeof users.$inferSelect;
export type CodeRow = typeof codes.$inferSelect;
export type RewardRow = typeof rewards.$inferSelect;
export type PlanRow = typeof recurringPlans.$inferSelect;
export type ActivityRow = typeof activity.$inferSelect;
