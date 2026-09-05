CREATE TABLE IF NOT EXISTS "ai_suggestions" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"suggestion_type" text NOT NULL,
	"target_field" text NOT NULL,
	"current_value" text,
	"proposed_value" text NOT NULL,
	"reasoning" text NOT NULL,
	"confidence" integer DEFAULT 50 NOT NULL,
	"status" text NOT NULL,
	"created_by" text NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"mutation_revision_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_suggestions_entity_idx" ON "ai_suggestions" USING btree ("entity_type","entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_suggestions_status_idx" ON "ai_suggestions" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_suggestions_created_at_idx" ON "ai_suggestions" USING btree ("created_at");
