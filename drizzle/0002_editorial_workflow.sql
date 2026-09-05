CREATE TABLE IF NOT EXISTS "editorial_workflows" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"status" text NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editorial_workflows_entity_unique" UNIQUE("entity_type","entity_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "editorial_workflow_events" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"previous_status" text,
	"new_status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "editorial_workflow_events" ADD CONSTRAINT "editorial_workflow_events_workflow_id_editorial_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."editorial_workflows"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "editorial_workflows_entity_idx" ON "editorial_workflows" USING btree ("entity_type","entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "editorial_workflows_status_idx" ON "editorial_workflows" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "editorial_workflow_events_workflow_id_idx" ON "editorial_workflow_events" USING btree ("workflow_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "editorial_workflow_events_created_at_idx" ON "editorial_workflow_events" USING btree ("created_at");
