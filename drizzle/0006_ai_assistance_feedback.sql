CREATE TABLE IF NOT EXISTS "ai_assistance_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"assistance_id" text NOT NULL,
	"disposition" text NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_assistance_feedback_assistance_id_unique" UNIQUE("assistance_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_assistance_feedback_events" (
	"id" text PRIMARY KEY NOT NULL,
	"feedback_id" text NOT NULL,
	"assistance_id" text NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"previous_disposition" text,
	"previous_reason" text,
	"new_disposition" text NOT NULL,
	"new_reason" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_assistance_feedback_disposition_idx" ON "ai_assistance_feedback" USING btree ("disposition");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_assistance_feedback_reason_idx" ON "ai_assistance_feedback" USING btree ("reason");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_assistance_feedback_created_at_idx" ON "ai_assistance_feedback" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_assistance_feedback_events_feedback_idx" ON "ai_assistance_feedback_events" USING btree ("feedback_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_assistance_feedback_events_assistance_idx" ON "ai_assistance_feedback_events" USING btree ("assistance_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_assistance_feedback_events_created_at_idx" ON "ai_assistance_feedback_events" USING btree ("created_at");
