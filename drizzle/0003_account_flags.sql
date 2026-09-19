CREATE TABLE "account_flags" (
	"user_id" uuid NOT NULL,
	"flag" text NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "account_flags_user_id_flag_pk" PRIMARY KEY("user_id","flag")
);
--> statement-breakpoint
ALTER TABLE "account_flags" ADD CONSTRAINT "account_flags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;