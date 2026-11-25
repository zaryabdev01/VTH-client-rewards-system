CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_name" text NOT NULL,
	"actor_id" uuid,
	"text" text NOT NULL,
	"kind" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"recipient_name" text NOT NULL,
	"organisation" text DEFAULT '' NOT NULL,
	"email" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_by_name" text DEFAULT 'System' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"emailed_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	"reward_id" integer,
	"ref" text,
	"claim_hash" text,
	"fulfilment" text,
	"fulfilled_at" timestamp with time zone,
	"fulfilled_by_name" text,
	"plan_id" uuid,
	"cycle_no" integer,
	CONSTRAINT "codes_code_unique" UNIQUE("code"),
	CONSTRAINT "codes_ref_unique" UNIQUE("ref")
);
--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"provider_id" text,
	"error" text,
	"code_id" uuid
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recurring_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_name" text NOT NULL,
	"organisation" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"frequency" text NOT NULL,
	"spins_per_cycle" integer DEFAULT 1 NOT NULL,
	"code_validity_days" integer DEFAULT 14 NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"max_cycles" integer,
	"cycles_done" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_by" uuid,
	"created_by_name" text DEFAULT 'System' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" integer PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"role" text DEFAULT 'standard' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"invite_token_hash" text,
	"invite_expires_at" timestamp with time zone,
	"invited_at" timestamp with time zone,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "codes" ADD CONSTRAINT "codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codes" ADD CONSTRAINT "codes_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codes" ADD CONSTRAINT "codes_plan_id_recurring_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."recurring_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_plans" ADD CONSTRAINT "recurring_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_at_idx" ON "activity" USING btree ("at");--> statement-breakpoint
CREATE INDEX "codes_status_idx" ON "codes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "codes_created_idx" ON "codes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "codes_plan_idx" ON "codes" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plans_due_idx" ON "recurring_plans" USING btree ("status","next_run_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");