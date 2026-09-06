/**
 * AI assistance persistence (Phase 43 + Phase 46 generation metadata).
 * Separate Neon table — never stored inside ProductV1 / ArticleV1.
 */
import { randomUUID } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { aiAssistanceOutputs } from "@/lib/db/schema";
import { ensureAIEvaluationTables } from "@/lib/ai-evaluation-store";
import type {
  AIAssistanceEntityType,
  AIAssistanceRecord,
  AIAssistanceStatus,
  AIAssistanceType,
} from "@/types/ai-assistance";

let tablesReady: Promise<void> | null = null;

export async function ensureAIAssistanceTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      const db = await getDb();
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ai_assistance_outputs (
          id text PRIMARY KEY NOT NULL,
          entity_type text NOT NULL,
          entity_id text NOT NULL,
          type text NOT NULL,
          input_context text NOT NULL,
          output text NOT NULL,
          status text NOT NULL,
          created_by text NOT NULL,
          reviewed_by text,
          reviewed_at timestamptz,
          suggestion_id text,
          task_id text,
          generation_metadata text,
          created_at timestamptz DEFAULT now() NOT NULL,
          updated_at timestamptz DEFAULT now() NOT NULL
        )
      `);
      await db.execute(sql`
        ALTER TABLE ai_assistance_outputs
        ADD COLUMN IF NOT EXISTS generation_metadata text
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS ai_assistance_outputs_entity_idx
          ON ai_assistance_outputs (entity_type, entity_id)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS ai_assistance_outputs_status_idx
          ON ai_assistance_outputs (status)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS ai_assistance_outputs_created_at_idx
          ON ai_assistance_outputs (created_at)
      `);
      await ensureAIEvaluationTables();
    })().catch((error) => {
      tablesReady = null;
      throw error;
    });
  }
  await tablesReady;
}

function toRecord(
  row: typeof aiAssistanceOutputs.$inferSelect,
): AIAssistanceRecord {
  return {
    id: row.id,
    entityType: row.entityType as AIAssistanceEntityType,
    entityId: row.entityId,
    type: row.type as AIAssistanceType,
    inputContext: row.inputContext,
    output: row.output,
    status: row.status as AIAssistanceStatus,
    createdBy: row.createdBy,
    reviewedBy: row.reviewedBy ?? null,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    suggestionId: row.suggestionId ?? null,
    taskId: row.taskId ?? null,
    generationMetadata: row.generationMetadata ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type InsertAIAssistanceInput = {
  entityType: AIAssistanceEntityType;
  entityId: string;
  type: AIAssistanceType;
  inputContext: string;
  output: string;
  createdBy: string;
  generationMetadata?: string | null;
};

export async function insertAIAssistance(
  input: InsertAIAssistanceInput,
): Promise<AIAssistanceRecord> {
  await ensureAIAssistanceTables();
  const db = await getDb();
  const id = randomUUID();
  const now = new Date();
  await db.insert(aiAssistanceOutputs).values({
    id,
    entityType: input.entityType,
    entityId: input.entityId,
    type: input.type,
    inputContext: input.inputContext,
    output: input.output,
    status: "draft",
    createdBy: input.createdBy,
    reviewedBy: null,
    reviewedAt: null,
    suggestionId: null,
    taskId: null,
    generationMetadata: input.generationMetadata ?? null,
    createdAt: now,
    updatedAt: now,
  });
  const rows = await db
    .select()
    .from(aiAssistanceOutputs)
    .where(eq(aiAssistanceOutputs.id, id))
    .limit(1);
  return toRecord(rows[0]!);
}

export async function findAIAssistanceById(
  id: string,
): Promise<AIAssistanceRecord | undefined> {
  await ensureAIAssistanceTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(aiAssistanceOutputs)
    .where(eq(aiAssistanceOutputs.id, id))
    .limit(1);
  return rows[0] ? toRecord(rows[0]) : undefined;
}

export async function listAIAssistanceByEntity(
  entityType: AIAssistanceEntityType,
  entityId: string,
): Promise<AIAssistanceRecord[]> {
  await ensureAIAssistanceTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(aiAssistanceOutputs)
    .where(
      and(
        eq(aiAssistanceOutputs.entityType, entityType),
        eq(aiAssistanceOutputs.entityId, entityId),
      ),
    )
    .orderBy(desc(aiAssistanceOutputs.createdAt));
  return rows.map(toRecord);
}

export async function listAllAIAssistance(
  limit = 100,
): Promise<AIAssistanceRecord[]> {
  await ensureAIAssistanceTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(aiAssistanceOutputs)
    .orderBy(desc(aiAssistanceOutputs.createdAt))
    .limit(limit);
  return rows.map(toRecord);
}

export async function updateAIAssistanceReview(input: {
  id: string;
  status: AIAssistanceStatus;
  reviewedBy: string;
  suggestionId?: string | null;
  taskId?: string | null;
}): Promise<AIAssistanceRecord | undefined> {
  await ensureAIAssistanceTables();
  const db = await getDb();
  const now = new Date();
  await db
    .update(aiAssistanceOutputs)
    .set({
      status: input.status,
      reviewedBy: input.reviewedBy,
      reviewedAt: now,
      suggestionId: input.suggestionId ?? null,
      taskId: input.taskId ?? null,
      updatedAt: now,
    })
    .where(eq(aiAssistanceOutputs.id, input.id));
  return findAIAssistanceById(input.id);
}

/** Test helper — hard delete. Production preserves assistance history. */
export async function deleteAIAssistanceForEntityForTests(
  entityType: AIAssistanceEntityType,
  entityId: string,
): Promise<void> {
  await ensureAIAssistanceTables();
  const db = await getDb();
  await db
    .delete(aiAssistanceOutputs)
    .where(
      and(
        eq(aiAssistanceOutputs.entityType, entityType),
        eq(aiAssistanceOutputs.entityId, entityId),
      ),
    );
}
