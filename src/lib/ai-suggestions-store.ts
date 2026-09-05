/**
 * AI suggestion persistence (Phase 40).
 * Separate Neon table — never stored inside ProductV1 / ArticleV1.
 */
import { randomUUID } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { aiSuggestions } from "@/lib/db/schema";
import type {
  AISuggestionEntityType,
  AISuggestionRecord,
  AISuggestionStatus,
  AISuggestionTargetField,
  AISuggestionType,
} from "@/types/ai-suggestion";

let tablesReady: Promise<void> | null = null;

/** Idempotent DDL so validation works before drizzle migrate. */
export async function ensureAiSuggestionTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      const db = await getDb();
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ai_suggestions (
          id text PRIMARY KEY NOT NULL,
          entity_type text NOT NULL,
          entity_id text NOT NULL,
          suggestion_type text NOT NULL,
          target_field text NOT NULL,
          current_value text,
          proposed_value text NOT NULL,
          reasoning text NOT NULL,
          confidence integer DEFAULT 50 NOT NULL,
          status text NOT NULL,
          created_by text NOT NULL,
          reviewed_by text,
          reviewed_at timestamptz,
          mutation_revision_id text,
          created_at timestamptz DEFAULT now() NOT NULL,
          updated_at timestamptz DEFAULT now() NOT NULL
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS ai_suggestions_entity_idx
          ON ai_suggestions (entity_type, entity_id)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS ai_suggestions_status_idx
          ON ai_suggestions (status)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS ai_suggestions_created_at_idx
          ON ai_suggestions (created_at)
      `);
    })().catch((error) => {
      tablesReady = null;
      throw error;
    });
  }
  await tablesReady;
}

function toRecord(row: typeof aiSuggestions.$inferSelect): AISuggestionRecord {
  return {
    id: row.id,
    entityType: row.entityType as AISuggestionEntityType,
    entityId: row.entityId,
    suggestionType: row.suggestionType as AISuggestionType,
    targetField: row.targetField as AISuggestionTargetField,
    currentValue: row.currentValue ?? null,
    proposedValue: row.proposedValue,
    reasoning: row.reasoning,
    confidence: row.confidence,
    status: row.status as AISuggestionStatus,
    createdBy: row.createdBy,
    reviewedBy: row.reviewedBy ?? null,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    mutationRevisionId: row.mutationRevisionId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type InsertAISuggestionInput = {
  entityType: AISuggestionEntityType;
  entityId: string;
  suggestionType: AISuggestionType;
  targetField: AISuggestionTargetField;
  currentValue: string | null;
  proposedValue: string;
  reasoning: string;
  confidence: number;
  createdBy: string;
};

export async function insertAISuggestion(
  input: InsertAISuggestionInput,
): Promise<AISuggestionRecord> {
  await ensureAiSuggestionTables();
  const db = await getDb();
  const id = randomUUID();
  const now = new Date();
  await db.insert(aiSuggestions).values({
    id,
    entityType: input.entityType,
    entityId: input.entityId,
    suggestionType: input.suggestionType,
    targetField: input.targetField,
    currentValue: input.currentValue,
    proposedValue: input.proposedValue,
    reasoning: input.reasoning,
    confidence: input.confidence,
    status: "pending",
    createdBy: input.createdBy,
    reviewedBy: null,
    reviewedAt: null,
    mutationRevisionId: null,
    createdAt: now,
    updatedAt: now,
  });
  const rows = await db
    .select()
    .from(aiSuggestions)
    .where(eq(aiSuggestions.id, id))
    .limit(1);
  return toRecord(rows[0]!);
}

export async function findAISuggestionById(
  id: string,
): Promise<AISuggestionRecord | undefined> {
  await ensureAiSuggestionTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(aiSuggestions)
    .where(eq(aiSuggestions.id, id))
    .limit(1);
  return rows[0] ? toRecord(rows[0]) : undefined;
}

export async function listAISuggestionsByEntity(
  entityType: AISuggestionEntityType,
  entityId: string,
): Promise<AISuggestionRecord[]> {
  await ensureAiSuggestionTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(aiSuggestions)
    .where(
      and(
        eq(aiSuggestions.entityType, entityType),
        eq(aiSuggestions.entityId, entityId),
      ),
    )
    .orderBy(desc(aiSuggestions.createdAt));
  return rows.map(toRecord);
}

export async function listAISuggestionsByStatus(
  status: AISuggestionStatus,
  limit = 50,
): Promise<AISuggestionRecord[]> {
  await ensureAiSuggestionTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(aiSuggestions)
    .where(eq(aiSuggestions.status, status))
    .orderBy(desc(aiSuggestions.createdAt))
    .limit(limit);
  return rows.map(toRecord);
}

/** Read-only listing for operational intelligence (Phase 44). */
export async function listAllAISuggestions(
  limit = 200,
): Promise<AISuggestionRecord[]> {
  await ensureAiSuggestionTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(aiSuggestions)
    .orderBy(desc(aiSuggestions.createdAt))
    .limit(limit);
  return rows.map(toRecord);
}

export async function updateAISuggestionStatus(input: {
  id: string;
  status: AISuggestionStatus;
  reviewedBy: string;
  mutationRevisionId?: string | null;
}): Promise<AISuggestionRecord | undefined> {
  await ensureAiSuggestionTables();
  const db = await getDb();
  const now = new Date();
  await db
    .update(aiSuggestions)
    .set({
      status: input.status,
      reviewedBy: input.reviewedBy,
      reviewedAt: now,
      mutationRevisionId: input.mutationRevisionId ?? null,
      updatedAt: now,
    })
    .where(eq(aiSuggestions.id, input.id));
  return findAISuggestionById(input.id);
}

/** Test helper — hard delete. Production never deletes suggestion history. */
export async function deleteAISuggestionsForEntityForTests(
  entityType: AISuggestionEntityType,
  entityId: string,
): Promise<void> {
  await ensureAiSuggestionTables();
  const db = await getDb();
  await db
    .delete(aiSuggestions)
    .where(
      and(
        eq(aiSuggestions.entityType, entityType),
        eq(aiSuggestions.entityId, entityId),
      ),
    );
}
