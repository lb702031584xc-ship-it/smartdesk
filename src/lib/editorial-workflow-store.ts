/**
 * Editorial workflow persistence (Phase 36).
 * Neon tables only — separate from ProductV1 / ArticleV1 documents.
 */
import { randomUUID } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  editorialWorkflowEvents,
  editorialWorkflows,
} from "@/lib/db/schema";
import type {
  EditorialWorkflowAction,
  EditorialWorkflowEntityType,
  EditorialWorkflowEvent,
  EditorialWorkflowRecord,
  EditorialWorkflowStatus,
} from "@/types/editorial-workflow";

let tablesReady: Promise<void> | null = null;

/** Idempotent DDL so validation works before drizzle migrate. */
export async function ensureEditorialWorkflowTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      const db = await getDb();
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS editorial_workflows (
          id text PRIMARY KEY NOT NULL,
          entity_type text NOT NULL,
          entity_id text NOT NULL,
          status text NOT NULL,
          created_by text NOT NULL,
          updated_by text NOT NULL,
          created_at timestamptz DEFAULT now() NOT NULL,
          updated_at timestamptz DEFAULT now() NOT NULL,
          CONSTRAINT editorial_workflows_entity_unique UNIQUE (entity_type, entity_id)
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS editorial_workflow_events (
          id text PRIMARY KEY NOT NULL,
          workflow_id text NOT NULL REFERENCES editorial_workflows(id) ON DELETE CASCADE,
          actor text NOT NULL,
          action text NOT NULL,
          previous_status text,
          new_status text NOT NULL,
          created_at timestamptz DEFAULT now() NOT NULL
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS editorial_workflows_entity_idx
          ON editorial_workflows (entity_type, entity_id)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS editorial_workflows_status_idx
          ON editorial_workflows (status)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS editorial_workflow_events_workflow_id_idx
          ON editorial_workflow_events (workflow_id)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS editorial_workflow_events_created_at_idx
          ON editorial_workflow_events (created_at)
      `);
    })().catch((error) => {
      tablesReady = null;
      throw error;
    });
  }
  await tablesReady;
}

function toRecord(row: typeof editorialWorkflows.$inferSelect): EditorialWorkflowRecord {
  return {
    id: row.id,
    entityType: row.entityType as EditorialWorkflowEntityType,
    entityId: row.entityId,
    status: row.status as EditorialWorkflowStatus,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toEvent(row: typeof editorialWorkflowEvents.$inferSelect): EditorialWorkflowEvent {
  return {
    id: row.id,
    workflowId: row.workflowId,
    actor: row.actor,
    action: row.action as EditorialWorkflowAction,
    previousStatus: (row.previousStatus as EditorialWorkflowStatus | null) ?? null,
    newStatus: row.newStatus as EditorialWorkflowStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function findWorkflowByEntity(
  entityType: EditorialWorkflowEntityType,
  entityId: string,
): Promise<EditorialWorkflowRecord | undefined> {
  await ensureEditorialWorkflowTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(editorialWorkflows)
    .where(
      and(
        eq(editorialWorkflows.entityType, entityType),
        eq(editorialWorkflows.entityId, entityId),
      ),
    )
    .limit(1);
  return rows[0] ? toRecord(rows[0]) : undefined;
}

export async function findWorkflowById(
  workflowId: string,
): Promise<EditorialWorkflowRecord | undefined> {
  await ensureEditorialWorkflowTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(editorialWorkflows)
    .where(eq(editorialWorkflows.id, workflowId))
    .limit(1);
  return rows[0] ? toRecord(rows[0]) : undefined;
}

export async function listWorkflowEvents(
  workflowId: string,
): Promise<EditorialWorkflowEvent[]> {
  await ensureEditorialWorkflowTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(editorialWorkflowEvents)
    .where(eq(editorialWorkflowEvents.workflowId, workflowId))
    .orderBy(desc(editorialWorkflowEvents.createdAt));
  return rows.map(toEvent);
}

export async function insertWorkflowWithEvent(input: {
  entityType: EditorialWorkflowEntityType;
  entityId: string;
  actor: string;
  status?: EditorialWorkflowStatus;
}): Promise<EditorialWorkflowRecord> {
  await ensureEditorialWorkflowTables();
  const db = await getDb();
  const id = randomUUID();
  const eventId = randomUUID();
  const status = input.status ?? "draft";
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(editorialWorkflows).values({
      id,
      entityType: input.entityType,
      entityId: input.entityId,
      status,
      createdBy: input.actor,
      updatedBy: input.actor,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(editorialWorkflowEvents).values({
      id: eventId,
      workflowId: id,
      actor: input.actor,
      action: "create",
      previousStatus: null,
      newStatus: status,
      createdAt: now,
    });
  });

  const record = await findWorkflowById(id);
  if (!record) throw new Error("Workflow insert failed.");
  return record;
}

export async function transitionWorkflow(input: {
  workflowId: string;
  actor: string;
  action: EditorialWorkflowAction;
  nextStatus: EditorialWorkflowStatus;
}): Promise<EditorialWorkflowRecord> {
  await ensureEditorialWorkflowTables();
  const db = await getDb();
  const now = new Date();

  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(editorialWorkflows)
      .where(eq(editorialWorkflows.id, input.workflowId))
      .for("update");
    const existing = rows[0];
    if (!existing) {
      throw new Error(`Workflow not found: ${input.workflowId}`);
    }

    await tx.insert(editorialWorkflowEvents).values({
      id: randomUUID(),
      workflowId: input.workflowId,
      actor: input.actor,
      action: input.action,
      previousStatus: existing.status,
      newStatus: input.nextStatus,
      createdAt: now,
    });

    await tx
      .update(editorialWorkflows)
      .set({
        status: input.nextStatus,
        updatedBy: input.actor,
        updatedAt: now,
      })
      .where(eq(editorialWorkflows.id, input.workflowId));
  });

  const record = await findWorkflowById(input.workflowId);
  if (!record) throw new Error("Workflow transition failed.");
  return record;
}

/** Test cleanup only. */
export async function deleteWorkflowForEntity(
  entityType: EditorialWorkflowEntityType,
  entityId: string,
): Promise<void> {
  await ensureEditorialWorkflowTables();
  const existing = await findWorkflowByEntity(entityType, entityId);
  if (!existing) return;
  const db = await getDb();
  await db
    .delete(editorialWorkflowEvents)
    .where(eq(editorialWorkflowEvents.workflowId, existing.id));
  await db
    .delete(editorialWorkflows)
    .where(eq(editorialWorkflows.id, existing.id));
}

/** Phase 37 — read-only: workflows by status (e.g. review queue). */
export async function listWorkflowsByStatus(
  status: EditorialWorkflowStatus,
): Promise<EditorialWorkflowRecord[]> {
  await ensureEditorialWorkflowTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(editorialWorkflows)
    .where(eq(editorialWorkflows.status, status))
    .orderBy(desc(editorialWorkflows.updatedAt));
  return rows.map(toRecord);
}

export type WorkflowEventWithEntity = EditorialWorkflowEvent & {
  entityType: EditorialWorkflowEntityType;
  entityId: string;
  workflowStatus: EditorialWorkflowStatus;
};

/** Phase 37 — read-only: recent workflow events across all entities. */
export async function listRecentWorkflowEvents(
  limit = 50,
): Promise<WorkflowEventWithEntity[]> {
  await ensureEditorialWorkflowTables();
  const db = await getDb();
  const rows = await db
    .select({
      event: editorialWorkflowEvents,
      entityType: editorialWorkflows.entityType,
      entityId: editorialWorkflows.entityId,
      workflowStatus: editorialWorkflows.status,
    })
    .from(editorialWorkflowEvents)
    .innerJoin(
      editorialWorkflows,
      eq(editorialWorkflowEvents.workflowId, editorialWorkflows.id),
    )
    .orderBy(desc(editorialWorkflowEvents.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    ...toEvent(row.event),
    entityType: row.entityType as EditorialWorkflowEntityType,
    entityId: row.entityId,
    workflowStatus: row.workflowStatus as EditorialWorkflowStatus,
  }));
}
