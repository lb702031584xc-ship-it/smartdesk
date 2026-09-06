import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import type { ArticleV1 } from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  data: jsonb("data").$type<ProductV1Document>().notNull(),
  version: integer("version").notNull().default(1),
  dbUpdatedAt: timestamp("db_updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const articles = pgTable("articles", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull(),
  body: text("body").notNull().default(""),
  data: jsonb("data").$type<ArticleV1>().notNull(),
  version: integer("version").notNull().default(1),
  dbUpdatedAt: timestamp("db_updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const articleRevisions = pgTable(
  "article_revisions",
  {
    id: text("id").primaryKey(),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id),
    revisionNumber: integer("revision_number").notNull(),
    data: jsonb("data").$type<ArticleV1>().notNull(),
    body: text("body").notNull(),
    sourceVersion: integer("source_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text("created_by").notNull(),
  },
  (table) => [
    unique("article_revisions_article_id_revision_number_unique").on(
      table.articleId,
      table.revisionNumber,
    ),
    index("article_revisions_article_id_idx").on(table.articleId),
    index("article_revisions_created_at_idx").on(table.createdAt),
  ],
);

export const productRevisions = pgTable(
  "product_revisions",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    revisionNumber: integer("revision_number").notNull(),
    data: jsonb("data").$type<ProductV1Document>().notNull(),
    sourceVersion: integer("source_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text("created_by").notNull(),
  },
  (table) => [
    unique("product_revisions_product_id_revision_number_unique").on(
      table.productId,
      table.revisionNumber,
    ),
    index("product_revisions_product_id_idx").on(table.productId),
    index("product_revisions_created_at_idx").on(table.createdAt),
  ],
);

/**
 * Phase 36 — editorial workflow current state (not ProductV1/ArticleV1).
 */
export const editorialWorkflows = pgTable(
  "editorial_workflows",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    status: text("status").notNull(),
    createdBy: text("created_by").notNull(),
    updatedBy: text("updated_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("editorial_workflows_entity_unique").on(
      table.entityType,
      table.entityId,
    ),
    index("editorial_workflows_entity_idx").on(table.entityType, table.entityId),
    index("editorial_workflows_status_idx").on(table.status),
  ],
);

/**
 * Phase 36 — append-only workflow audit history.
 */
export const editorialWorkflowEvents = pgTable(
  "editorial_workflow_events",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => editorialWorkflows.id),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    previousStatus: text("previous_status"),
    newStatus: text("new_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("editorial_workflow_events_workflow_id_idx").on(table.workflowId),
    index("editorial_workflow_events_created_at_idx").on(table.createdAt),
  ],
);

/**
 * Phase 40 — AI suggestion records (separate from canonical ProductV1 / ArticleV1).
 */
export const aiSuggestions = pgTable(
  "ai_suggestions",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    suggestionType: text("suggestion_type").notNull(),
    targetField: text("target_field").notNull(),
    currentValue: text("current_value"),
    proposedValue: text("proposed_value").notNull(),
    reasoning: text("reasoning").notNull(),
    confidence: integer("confidence").notNull().default(50),
    status: text("status").notNull(),
    createdBy: text("created_by").notNull(),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    mutationRevisionId: text("mutation_revision_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ai_suggestions_entity_idx").on(table.entityType, table.entityId),
    index("ai_suggestions_status_idx").on(table.status),
    index("ai_suggestions_created_at_idx").on(table.createdAt),
  ],
);

export type ProductRow = typeof products.$inferSelect;
export type ArticleRow = typeof articles.$inferSelect;
export type ArticleRevisionRow = typeof articleRevisions.$inferSelect;
export type ProductRevisionRow = typeof productRevisions.$inferSelect;
export type EditorialWorkflowRow = typeof editorialWorkflows.$inferSelect;
export type EditorialWorkflowEventRow = typeof editorialWorkflowEvents.$inferSelect;
export type AISuggestionRow = typeof aiSuggestions.$inferSelect;

/**
 * Phase 42 — Editorial task records (operational layer, not canonical content).
 */
export const editorialTasks = pgTable(
  "editorial_tasks",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    priority: text("priority").notNull(),
    status: text("status").notNull(),
    assignee: text("assignee"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("editorial_tasks_entity_idx").on(table.entityType, table.entityId),
    index("editorial_tasks_status_idx").on(table.status),
    index("editorial_tasks_source_idx").on(table.sourceType, table.sourceId),
    index("editorial_tasks_created_at_idx").on(table.createdAt),
  ],
);

export type EditorialTaskRow = typeof editorialTasks.$inferSelect;

/**
 * Phase 43 — AI assistance drafts (not canonical content).
 */
export const aiAssistanceOutputs = pgTable(
  "ai_assistance_outputs",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    type: text("type").notNull(),
    inputContext: text("input_context").notNull(),
    output: text("output").notNull(),
    status: text("status").notNull(),
    createdBy: text("created_by").notNull(),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    suggestionId: text("suggestion_id"),
    taskId: text("task_id"),
    /** Phase 46 — JSON generation provenance; null = not-recorded (legacy rows). */
    generationMetadata: text("generation_metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ai_assistance_outputs_entity_idx").on(
      table.entityType,
      table.entityId,
    ),
    index("ai_assistance_outputs_status_idx").on(table.status),
    index("ai_assistance_outputs_created_at_idx").on(table.createdAt),
  ],
);

export type AIAssistanceOutputRow = typeof aiAssistanceOutputs.$inferSelect;

/**
 * Phase 45 — structured human feedback on AI assistance (evaluation only).
 * Does not mutate ProductV1 / ArticleV1 / prompts / scores.
 */
export const aiAssistanceFeedback = pgTable(
  "ai_assistance_feedback",
  {
    id: text("id").primaryKey(),
    assistanceId: text("assistance_id").notNull().unique(),
    disposition: text("disposition").notNull(),
    reason: text("reason").notNull(),
    note: text("note"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ai_assistance_feedback_disposition_idx").on(table.disposition),
    index("ai_assistance_feedback_reason_idx").on(table.reason),
    index("ai_assistance_feedback_created_at_idx").on(table.createdAt),
  ],
);

export type AIAssistanceFeedbackRow = typeof aiAssistanceFeedback.$inferSelect;

export const aiAssistanceFeedbackEvents = pgTable(
  "ai_assistance_feedback_events",
  {
    id: text("id").primaryKey(),
    feedbackId: text("feedback_id").notNull(),
    assistanceId: text("assistance_id").notNull(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    previousDisposition: text("previous_disposition"),
    previousReason: text("previous_reason"),
    newDisposition: text("new_disposition").notNull(),
    newReason: text("new_reason").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ai_assistance_feedback_events_feedback_idx").on(table.feedbackId),
    index("ai_assistance_feedback_events_assistance_idx").on(
      table.assistanceId,
    ),
    index("ai_assistance_feedback_events_created_at_idx").on(table.createdAt),
  ],
);

export type AIAssistanceFeedbackEventRow =
  typeof aiAssistanceFeedbackEvents.$inferSelect;

/**
 * Phase 46 — materialized evaluation snapshots (versioned JSON).
 * Live analytics can build without this table; exports may materialize.
 */
export const aiEvaluationSnapshots = pgTable(
  "ai_evaluation_snapshots",
  {
    id: text("id").primaryKey(),
    assistanceId: text("assistance_id").notNull(),
    snapshotVersion: integer("snapshot_version").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ai_evaluation_snapshots_assistance_idx").on(table.assistanceId),
    index("ai_evaluation_snapshots_created_at_idx").on(table.createdAt),
    index("ai_evaluation_snapshots_version_idx").on(table.snapshotVersion),
  ],
);

export type AIEvaluationSnapshotRow = typeof aiEvaluationSnapshots.$inferSelect;
