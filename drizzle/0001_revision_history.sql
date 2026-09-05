CREATE TABLE "article_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"article_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"data" jsonb NOT NULL,
	"body" text NOT NULL,
	"source_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	CONSTRAINT "article_revisions_article_id_revision_number_unique" UNIQUE("article_id","revision_number")
);
--> statement-breakpoint
CREATE TABLE "product_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"data" jsonb NOT NULL,
	"source_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	CONSTRAINT "product_revisions_product_id_revision_number_unique" UNIQUE("product_id","revision_number")
);
--> statement-breakpoint
ALTER TABLE "article_revisions" ADD CONSTRAINT "article_revisions_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_revisions" ADD CONSTRAINT "product_revisions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "article_revisions_article_id_idx" ON "article_revisions" USING btree ("article_id");
--> statement-breakpoint
CREATE INDEX "article_revisions_created_at_idx" ON "article_revisions" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "product_revisions_product_id_idx" ON "product_revisions" USING btree ("product_id");
--> statement-breakpoint
CREATE INDEX "product_revisions_created_at_idx" ON "product_revisions" USING btree ("created_at");
