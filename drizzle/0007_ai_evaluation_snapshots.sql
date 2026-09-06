CREATE TABLE IF NOT EXISTS "ai_evaluation_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"assistance_id" text NOT NULL,
	"snapshot_version" integer NOT NULL,
	"snapshot_json" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_evaluation_snapshots_assistance_idx" ON "ai_evaluation_snapshots" USING btree ("assistance_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_evaluation_snapshots_created_at_idx" ON "ai_evaluation_snapshots" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_evaluation_snapshots_version_idx" ON "ai_evaluation_snapshots" USING btree ("snapshot_version");
--> statement-breakpoint
ALTER TABLE "ai_assistance_outputs" ADD COLUMN IF NOT EXISTS "generation_metadata" text;
