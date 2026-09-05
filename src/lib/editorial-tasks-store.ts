/**
 * Editorial task persistence (Phase 42).
 * Separate Neon table — never stored inside ProductV1 / ArticleV1.
 */
import { randomUUID } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { editorialTasks } from "@/lib/db/schema";
import type {
  EditorialTaskEntityType,
  EditorialTaskPriority,
  EditorialTaskRecord,
  EditorialTaskSourceType,
  EditorialTaskStatus,
} from "@/types/editorial-task";

let tablesReady: Promise<void> | null = null;

export async function ensureEditorialTaskTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      const db = await getDb();
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS editorial_tasks (
          id text PRIMARY KEY NOT NULL,
          entity_type text NOT NULL,
          entity_id text NOT NULL,
          source_type text NOT NULL,
          source_id text,
          title text NOT NULL,
          description text DEFAULT '' NOT NULL,
          priority text NOT NULL,
          status text NOT NULL,
          assignee text,
          created_by text NOT NULL,
          created_at timestamptz DEFAULT now() NOT NULL,
          updated_at timestamptz DEFAULT now() NOT NULL
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS editorial_tasks_entity_idx
          ON editorial_tasks (entity_type, entity_id)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS editorial_tasks_status_idx
          ON editorial_tasks (status)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS editorial_tasks_source_idx
          ON editorial_tasks (source_type, source_id)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS editorial_tasks_created_at_idx
          ON editorial_tasks (created_at)
      `);
    })().catch((error) => {
      tablesReady = null;
      throw error;
    });
  }
  await tablesReady;
}

function toRecord(row: typeof editorialTasks.$inferSelect): EditorialTaskRecord {
  return {
    id: row.id,
    entityType: row.entityType as EditorialTaskEntityType,
    entityId: row.entityId,
    sourceType: row.sourceType as EditorialTaskSourceType,
    sourceId: row.sourceId ?? null,
    title: row.title,
    description: row.description,
    priority: row.priority as EditorialTaskPriority,
    status: row.status as EditorialTaskStatus,
    assignee: row.assignee ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type InsertEditorialTaskInput = {
  entityType: EditorialTaskEntityType;
  entityId: string;
  sourceType: EditorialTaskSourceType;
  sourceId: string | null;
  title: string;
  description: string;
  priority: EditorialTaskPriority;
  createdBy: string;
  assignee?: string | null;
};

export async function insertEditorialTask(
  input: InsertEditorialTaskInput,
): Promise<EditorialTaskRecord> {
  await ensureEditorialTaskTables();
  const db = await getDb();
  const id = randomUUID();
  const now = new Date();
  await db.insert(editorialTasks).values({
    id,
    entityType: input.entityType,
    entityId: input.entityId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    title: input.title,
    description: input.description,
    priority: input.priority,
    status: "open",
    assignee: input.assignee ?? null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });
  const rows = await db
    .select()
    .from(editorialTasks)
    .where(eq(editorialTasks.id, id))
    .limit(1);
  return toRecord(rows[0]!);
}

export async function findEditorialTaskById(
  id: string,
): Promise<EditorialTaskRecord | undefined> {
  await ensureEditorialTaskTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(editorialTasks)
    .where(eq(editorialTasks.id, id))
    .limit(1);
  return rows[0] ? toRecord(rows[0]) : undefined;
}

export async function listEditorialTasksByEntity(
  entityType: EditorialTaskEntityType,
  entityId: string,
): Promise<EditorialTaskRecord[]> {
  await ensureEditorialTaskTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(editorialTasks)
    .where(
      and(
        eq(editorialTasks.entityType, entityType),
        eq(editorialTasks.entityId, entityId),
      ),
    )
    .orderBy(desc(editorialTasks.createdAt));
  return rows.map(toRecord);
}

export async function listEditorialTasksByStatus(
  status: EditorialTaskStatus,
  limit = 100,
): Promise<EditorialTaskRecord[]> {
  await ensureEditorialTaskTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(editorialTasks)
    .where(eq(editorialTasks.status, status))
    .orderBy(desc(editorialTasks.createdAt))
    .limit(limit);
  return rows.map(toRecord);
}

export async function listAllEditorialTasks(
  limit = 200,
): Promise<EditorialTaskRecord[]> {
  await ensureEditorialTaskTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(editorialTasks)
    .orderBy(desc(editorialTasks.createdAt))
    .limit(limit);
  return rows.map(toRecord);
}

export async function updateEditorialTaskFields(input: {
  id: string;
  status?: EditorialTaskStatus;
  assignee?: string | null;
}): Promise<EditorialTaskRecord | undefined> {
  await ensureEditorialTaskTables();
  const db = await getDb();
  const patch: Partial<typeof editorialTasks.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.status !== undefined) patch.status = input.status;
  if (input.assignee !== undefined) patch.assignee = input.assignee;

  await db
    .update(editorialTasks)
    .set(patch)
    .where(eq(editorialTasks.id, input.id));
  return findEditorialTaskById(input.id);
}

/** Test helper — hard delete tasks for fixture entity. */
export async function deleteEditorialTasksForEntityForTests(
  entityType: EditorialTaskEntityType,
  entityId: string,
): Promise<void> {
  await ensureEditorialTaskTables();
  const db = await getDb();
  await db
    .delete(editorialTasks)
    .where(
      and(
        eq(editorialTasks.entityType, entityType),
        eq(editorialTasks.entityId, entityId),
      ),
    );
}
