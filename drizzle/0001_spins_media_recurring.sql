CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mime" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"size" integer NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "codes" ADD COLUMN "spins_allowed" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "codes" ADD COLUMN "spins_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "codes" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "codes" ADD COLUMN "voided" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_plans" ADD COLUMN "expire_at_next" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "rewards" ADD COLUMN "media_type" text;--> statement-breakpoint
ALTER TABLE "rewards" ADD COLUMN "media_url" text;
--> statement-breakpoint
UPDATE "codes" SET "spins_used" = 1, "accepted_at" = "used_at" WHERE "status" = 'used';
