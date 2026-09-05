CREATE TABLE IF NOT EXISTS "ai_assistance_outputs" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"type" text NOT NULL,
	"input_context" text NOT NULL,
	"output" text NOT NULL,
	"status" text NOT NULL,
	"created_by" text NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"suggestion_id" text,
	"task_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_assistance_outputs_entity_idx" ON "ai_assistance_outputs" USING btree ("entity_type","entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_assistance_outputs_status_idx" ON "ai_assistance_outputs" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_assistance_outputs_created_at_idx" ON "ai_assistance_outputs" USING btree ("created_at");
