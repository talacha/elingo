CREATE TABLE "app_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "safe_word_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "allow_images" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "allow_voice" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "allow_text" boolean DEFAULT true NOT NULL;