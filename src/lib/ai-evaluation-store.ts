/**
 * Evaluation snapshot persistence (Phase 46).
 * Materialized copies of Evaluation Records — optional; analytics can build live.
 */
import { createHash, randomUUID } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { aiEvaluationSnapshots } from "@/lib/db/schema";
import type { AIEvaluationRecord } from "@/types/ai-evaluation";
import { EVALUATION_SNAPSHOT_VERSION } from "@/types/ai-evaluation";

let tablesReady: Promise<void> | null = null;

export async function ensureAIEvaluationTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      const db = await getDb();
      await db.execute(sql`
        ALTER TABLE ai_assistance_outputs
        ADD COLUMN IF NOT EXISTS generation_metadata text
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ai_evaluation_snapshots (
          id text PRIMARY KEY NOT NULL,
          assistance_id text NOT NULL,
          snapshot_version integer NOT NULL,
          snapshot_json text NOT NULL,
          created_at timestamptz DEFAULT now() NOT NULL
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS ai_evaluation_snapshots_assistance_idx
          ON ai_evaluation_snapshots (assistance_id)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS ai_evaluation_snapshots_created_at_idx
          ON ai_evaluation_snapshots (created_at)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS ai_evaluation_snapshots_version_idx
          ON ai_evaluation_snapshots (snapshot_version)
      `);
    })().catch((error) => {
      tablesReady = null;
      throw error;
    });
  }
  await tablesReady;
}

export function hashContextPayload(serialized: string): string {
  return createHash("sha256").update(serialized).digest("hex").slice(0, 16);
}

export async function insertEvaluationSnapshot(
  record: AIEvaluationRecord,
): Promise<{ id: string }> {
  await ensureAIEvaluationTables();
  const db = await getDb();
  const id = randomUUID();
  const payload: AIEvaluationRecord = {
    ...record,
    snapshot: {
      version: EVALUATION_SNAPSHOT_VERSION,
      createdAt: new Date().toISOString(),
      mode: "materialized",
    },
  };
  await db.insert(aiEvaluationSnapshots).values({
    id,
    assistanceId: record.assistanceId,
    snapshotVersion: EVALUATION_SNAPSHOT_VERSION,
    snapshotJson: JSON.stringify(payload),
    createdAt: new Date(),
  });
  return { id };
}

export async function listSnapshotsForAssistance(
  assistanceId: string,
): Promise<
  {
    id: string;
    snapshotVersion: number;
    createdAt: string;
    record: AIEvaluationRecord;
  }[]
> {
  await ensureAIEvaluationTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(aiEvaluationSnapshots)
    .where(eq(aiEvaluationSnapshots.assistanceId, assistanceId))
    .orderBy(desc(aiEvaluationSnapshots.createdAt));
  return rows.map((row) => ({
    id: row.id,
    snapshotVersion: row.snapshotVersion,
    createdAt: row.createdAt.toISOString(),
    record: JSON.parse(row.snapshotJson) as AIEvaluationRecord,
  }));
}

export async function deleteEvaluationSnapshotsForAssistanceForTests(
  assistanceId: string,
): Promise<void> {
  await ensureAIEvaluationTables();
  const db = await getDb();
  await db
    .delete(aiEvaluationSnapshots)
    .where(eq(aiEvaluationSnapshots.assistanceId, assistanceId));
}

export async function countSnapshotsForAssistance(
  assistanceId: string,
): Promise<number> {
  await ensureAIEvaluationTables();
  const db = await getDb();
  const rows = await db
    .select({ id: aiEvaluationSnapshots.id })
    .from(aiEvaluationSnapshots)
    .where(
      and(
        eq(aiEvaluationSnapshots.assistanceId, assistanceId),
        eq(aiEvaluationSnapshots.snapshotVersion, EVALUATION_SNAPSHOT_VERSION),
      ),
    );
  return rows.length;
}
