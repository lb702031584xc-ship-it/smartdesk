/**
 * AI assistance feedback persistence (Phase 45).
 * Evaluation storage only — never writes ProductV1 / ArticleV1.
 */
import { randomUUID } from "crypto";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  aiAssistanceFeedback,
  aiAssistanceFeedbackEvents,
} from "@/lib/db/schema";
import type {
  AIAssistanceFeedbackEventRecord,
  AIAssistanceFeedbackRecord,
  AIFeedbackDisposition,
  AIFeedbackReason,
} from "@/types/ai-feedback";

let tablesReady: Promise<void> | null = null;

export async function ensureAIFeedbackTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      const db = await getDb();
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ai_assistance_feedback (
          id text PRIMARY KEY NOT NULL,
          assistance_id text NOT NULL UNIQUE,
          disposition text NOT NULL,
          reason text NOT NULL,
          note text,
          created_by text NOT NULL,
          created_at timestamptz DEFAULT now() NOT NULL,
          updated_by text,
          updated_at timestamptz DEFAULT now() NOT NULL
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ai_assistance_feedback_events (
          id text PRIMARY KEY NOT NULL,
          feedback_id text NOT NULL,
          assistance_id text NOT NULL,
          actor text NOT NULL,
          action text NOT NULL,
          previous_disposition text,
          previous_reason text,
          new_disposition text NOT NULL,
          new_reason text NOT NULL,
          note text,
          created_at timestamptz DEFAULT now() NOT NULL
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS ai_assistance_feedback_disposition_idx
          ON ai_assistance_feedback (disposition)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS ai_assistance_feedback_reason_idx
          ON ai_assistance_feedback (reason)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS ai_assistance_feedback_created_at_idx
          ON ai_assistance_feedback (created_at)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS ai_assistance_feedback_events_feedback_idx
          ON ai_assistance_feedback_events (feedback_id)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS ai_assistance_feedback_events_assistance_idx
          ON ai_assistance_feedback_events (assistance_id)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS ai_assistance_feedback_events_created_at_idx
          ON ai_assistance_feedback_events (created_at)
      `);
    })().catch((error) => {
      tablesReady = null;
      throw error;
    });
  }
  await tablesReady;
}

function toFeedbackRecord(
  row: typeof aiAssistanceFeedback.$inferSelect,
): AIAssistanceFeedbackRecord {
  return {
    id: row.id,
    assistanceId: row.assistanceId,
    disposition: row.disposition as AIFeedbackDisposition,
    reason: row.reason as AIFeedbackReason,
    note: row.note ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedBy: row.updatedBy ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toEventRecord(
  row: typeof aiAssistanceFeedbackEvents.$inferSelect,
): AIAssistanceFeedbackEventRecord {
  return {
    id: row.id,
    feedbackId: row.feedbackId,
    assistanceId: row.assistanceId,
    actor: row.actor,
    action: row.action as "create" | "update",
    previousDisposition: (row.previousDisposition ??
      null) as AIFeedbackDisposition | null,
    previousReason: (row.previousReason ?? null) as AIFeedbackReason | null,
    newDisposition: row.newDisposition as AIFeedbackDisposition,
    newReason: row.newReason as AIFeedbackReason,
    note: row.note ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function findFeedbackByAssistanceId(
  assistanceId: string,
): Promise<AIAssistanceFeedbackRecord | undefined> {
  await ensureAIFeedbackTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(aiAssistanceFeedback)
    .where(eq(aiAssistanceFeedback.assistanceId, assistanceId))
    .limit(1);
  return rows[0] ? toFeedbackRecord(rows[0]) : undefined;
}

export async function findFeedbackById(
  id: string,
): Promise<AIAssistanceFeedbackRecord | undefined> {
  await ensureAIFeedbackTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(aiAssistanceFeedback)
    .where(eq(aiAssistanceFeedback.id, id))
    .limit(1);
  return rows[0] ? toFeedbackRecord(rows[0]) : undefined;
}

export async function listAllFeedback(
  limit = 200,
): Promise<AIAssistanceFeedbackRecord[]> {
  await ensureAIFeedbackTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(aiAssistanceFeedback)
    .orderBy(desc(aiAssistanceFeedback.createdAt))
    .limit(limit);
  return rows.map(toFeedbackRecord);
}

export async function listFeedbackEvents(
  feedbackId: string,
): Promise<AIAssistanceFeedbackEventRecord[]> {
  await ensureAIFeedbackTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(aiAssistanceFeedbackEvents)
    .where(eq(aiAssistanceFeedbackEvents.feedbackId, feedbackId))
    .orderBy(desc(aiAssistanceFeedbackEvents.createdAt));
  return rows.map(toEventRecord);
}

export async function insertFeedback(input: {
  assistanceId: string;
  disposition: AIFeedbackDisposition;
  reason: AIFeedbackReason;
  note: string | null;
  createdBy: string;
}): Promise<AIAssistanceFeedbackRecord> {
  await ensureAIFeedbackTables();
  const db = await getDb();
  const id = randomUUID();
  const eventId = randomUUID();
  const now = new Date();

  await db.insert(aiAssistanceFeedback).values({
    id,
    assistanceId: input.assistanceId,
    disposition: input.disposition,
    reason: input.reason,
    note: input.note,
    createdBy: input.createdBy,
    createdAt: now,
    updatedBy: null,
    updatedAt: now,
  });

  await db.insert(aiAssistanceFeedbackEvents).values({
    id: eventId,
    feedbackId: id,
    assistanceId: input.assistanceId,
    actor: input.createdBy,
    action: "create",
    previousDisposition: null,
    previousReason: null,
    newDisposition: input.disposition,
    newReason: input.reason,
    note: input.note,
    createdAt: now,
  });

  const created = await findFeedbackById(id);
  if (!created) throw new Error("Failed to insert feedback");
  return created;
}

export async function updateFeedback(input: {
  id: string;
  disposition: AIFeedbackDisposition;
  reason: AIFeedbackReason;
  note: string | null;
  updatedBy: string;
}): Promise<AIAssistanceFeedbackRecord | undefined> {
  await ensureAIFeedbackTables();
  const existing = await findFeedbackById(input.id);
  if (!existing) return undefined;

  const db = await getDb();
  const now = new Date();

  await db
    .update(aiAssistanceFeedback)
    .set({
      disposition: input.disposition,
      reason: input.reason,
      note: input.note,
      updatedBy: input.updatedBy,
      updatedAt: now,
    })
    .where(eq(aiAssistanceFeedback.id, input.id));

  await db.insert(aiAssistanceFeedbackEvents).values({
    id: randomUUID(),
    feedbackId: input.id,
    assistanceId: existing.assistanceId,
    actor: input.updatedBy,
    action: "update",
    previousDisposition: existing.disposition,
    previousReason: existing.reason,
    newDisposition: input.disposition,
    newReason: input.reason,
    note: input.note,
    createdAt: now,
  });

  return findFeedbackById(input.id);
}

/** Test helper — hard delete. Production preserves feedback history. */
export async function deleteFeedbackForAssistanceForTests(
  assistanceId: string,
): Promise<void> {
  await ensureAIFeedbackTables();
  const db = await getDb();
  await db
    .delete(aiAssistanceFeedbackEvents)
    .where(eq(aiAssistanceFeedbackEvents.assistanceId, assistanceId));
  await db
    .delete(aiAssistanceFeedback)
    .where(eq(aiAssistanceFeedback.assistanceId, assistanceId));
}
