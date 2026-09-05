CREATE TABLE IF NOT EXISTS "editorial_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"priority" text NOT NULL,
	"status" text NOT NULL,
	"assignee" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "editorial_tasks_entity_idx" ON "editorial_tasks" USING btree ("entity_type","entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "editorial_tasks_status_idx" ON "editorial_tasks" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "editorial_tasks_source_idx" ON "editorial_tasks" USING btree ("source_type","source_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "editorial_tasks_created_at_idx" ON "editorial_tasks" USING btree ("created_at");
