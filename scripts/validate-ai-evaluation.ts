/**
 * AI Evaluation Dataset / Quality Analytics validation (Phase 46).
 * Usage: npm run validate:ai-evaluation
 */
import "./load-env-local";
import fs from "fs";
import path from "path";
import {
  buildDefaultGenerationMetadata,
  buildEvaluationDataset,
  buildEvaluationExportCsv,
  buildEvaluationRecord,
  computeEditBurdenProxy,
  EVALUATION_FORBIDDEN_SIDE_EFFECTS,
  getAIQualityAnalytics,
  materializeEvaluationSnapshot,
  parseGenerationMetadata,
  redactContextForEvaluation,
} from "../src/lib/ai-evaluation";
import { deleteEvaluationSnapshotsForAssistanceForTests } from "../src/lib/ai-evaluation-store";
import {
  acceptAssistance,
  generateAssistance,
  rejectAssistance,
} from "../src/lib/ai-assistance";
import { deleteAIAssistanceForEntityForTests } from "../src/lib/ai-assistance-store";
import { submitAssistanceFeedback } from "../src/lib/ai-feedback";
import { deleteFeedbackForAssistanceForTests } from "../src/lib/ai-feedback-store";
import { deleteAISuggestionsForEntityForTests } from "../src/lib/ai-suggestions";
import {
  createEditorialTask,
  deleteEditorialTasksForEntityForTests,
} from "../src/lib/editorial-tasks";
import {
  createAdminArticle,
  deleteAdminArticleRecord,
  getAdminArticle,
} from "../src/lib/admin/article-store";
import { blankArticleV1 } from "../src/lib/admin/blank-article";
import { closeDb } from "../src/lib/db/client";
import { isDatabaseContentStore } from "../src/lib/content/store-config";
import type { ArticleV1 } from "../src/types/article-v1";
import { EVALUATION_SNAPSHOT_VERSION } from "../src/types/ai-evaluation";

const ARTICLE_ID = "zz-phase46-ai-evaluation";
const ARTICLE_SLUG = "zz-phase46-ai-evaluation";
const ACTOR = "phase46-evaluation@smartdesksetup.com";

let passed = 0;
let failed = 0;

function assert(condition: unknown, message: string) {
  if (condition) passed++;
  else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

function assertFile(rel: string) {
  assert(fs.existsSync(path.join(process.cwd(), rel)), `exists ${rel}`);
}

function ensureActorAdmin() {
  const admins = new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
  admins.add(ACTOR);
  process.env.ADMIN_EMAILS = [...admins].join(",");
}

async function cleanup() {
  if (isDatabaseContentStore()) {
    const { listAIAssistanceByEntity } = await import(
      "../src/lib/ai-assistance-store"
    );
    const rows = await listAIAssistanceByEntity("article", ARTICLE_ID).catch(
      () => [],
    );
    for (const row of rows) {
      await deleteFeedbackForAssistanceForTests(row.id).catch(() => undefined);
      await deleteEvaluationSnapshotsForAssistanceForTests(row.id).catch(
        () => undefined,
      );
    }
  }
  await deleteAIAssistanceForEntityForTests("article", ARTICLE_ID).catch(
    () => undefined,
  );
  await deleteAISuggestionsForEntityForTests("article", ARTICLE_ID).catch(
    () => undefined,
  );
  await deleteEditorialTasksForEntityForTests("article", ARTICLE_ID).catch(
    () => undefined,
  );
  await deleteAdminArticleRecord(ARTICLE_ID, ARTICLE_SLUG).catch(
    () => undefined,
  );
}

function testArticle(): ArticleV1 {
  return {
    ...blankArticleV1(),
    identity: {
      id: ARTICLE_ID,
      slug: ARTICLE_SLUG,
      title: "Phase 46 Evaluation Fixture",
    },
    classification: { type: "guide", category: "chairs" },
    editorial: { intent: "commercial", summary: "Evaluation test." },
    seo: {
      metaTitle: "Short",
      metaDescription: "Desc",
      primaryKeyword: "office chairs",
      secondaryKeywords: [],
    },
    publishing: { status: "draft", featured: false },
  };
}

async function main() {
  console.log("=== Phase 46 file presence ===");
  assertFile("src/types/ai-evaluation.ts");
  assertFile("src/lib/ai-evaluation.ts");
  assertFile("src/lib/ai-evaluation-store.ts");
  assertFile("drizzle/0007_ai_evaluation_snapshots.sql");
  assertFile("src/app/dashboard/intelligence/ai-evaluation/page.tsx");
  assertFile(
    "src/app/dashboard/intelligence/ai-evaluation/[assistanceId]/page.tsx",
  );

  console.log("=== Pure: provenance + redaction + edit burden ===");
  const meta = buildDefaultGenerationMetadata("abc123");
  assert(meta.provider === "deterministic-rules", "default provider");
  assert(meta.model === "not-recorded", "model not fabricated as real LLM");
  const legacy = parseGenerationMetadata(null, "hash1");
  assert(legacy.provider === "not-recorded", "legacy provider not-recorded");
  const redacted = redactContextForEvaluation(
    JSON.stringify({ title: "ok", api_key: "secret", nested: { token: "x" } }),
  );
  assert(redacted.includes("[redacted]"), "secrets redacted");
  assert(redacted.includes("ok"), "non-secret kept");
  assert(
    !computeEditBurdenProxy({
      currentValue: "a",
      proposedValue: "ab",
      mutationRevisionId: null,
    }).available,
    "edit burden unavailable without revision link",
  );
  const burden = computeEditBurdenProxy({
    currentValue: "hello",
    proposedValue: "hello world",
    mutationRevisionId: "rev-1",
  });
  assert(burden.available && burden.characterDelta === 6, "edit burden delta");
  assert(
    EVALUATION_FORBIDDEN_SIDE_EFFECTS.includes("fine-tune"),
    "fine-tune forbidden",
  );
  assert(
    EVALUATION_SNAPSHOT_VERSION === 1,
    "snapshot version 1",
  );

  if (!isDatabaseContentStore()) {
    console.log("CONTENT_STORE!=database — skipping integration");
    console.log(`${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  }

  ensureActorAdmin();
  await cleanup();

  console.log("=== Integration: evaluation builder ===");
  const created = await createAdminArticle(testArticle(), {
    body: "# Phase 46\n",
  });
  assert(created.ok, "fixture article created");
  if (!created.ok) {
    console.error(created);
    throw new Error("fixture article create failed");
  }

  const gen = await generateAssistance({
    entityType: "article",
    entityId: ARTICLE_ID,
    type: "seo",
    createdBy: ACTOR,
  });
  assert(gen.success, "generate assistance");
  if (!gen.success) throw new Error(gen.message);

  const draftRecord = await buildEvaluationRecord(gen.assistance.id);
  assert(draftRecord, "draft evaluation record");
  assert(
    draftRecord!.generation.provider === "deterministic-rules" ||
      draftRecord!.generation.provider === "not-recorded",
    "generation provenance known or not-recorded",
  );
  assert(
    draftRecord!.attribution.linkage === "unknown",
    "draft/no-link → unknown attribution",
  );
  assert(
    draftRecord!.snapshot.version === 1,
    "snapshot version on live record",
  );

  const accepted = await acceptAssistance(gen.assistance.id, ACTOR);
  assert(accepted.success, "accept assistance");

  const asIs = await submitAssistanceFeedback({
    assistanceId: gen.assistance.id,
    disposition: "accepted-as-is",
    reason: "useful-but-needs-editing",
    note: null,
    actor: ACTOR,
  });
  assert(asIs.success, "accepted-as-is feedback");

  const withFeedback = await buildEvaluationRecord(gen.assistance.id);
  assert(withFeedback?.qualityLabels.hasFeedback, "has feedback");
  assert(
    withFeedback?.feedback.disposition === "accepted-as-is",
    "disposition on record",
  );
  assert(
    withFeedback!.feedbackHistory.length >= 1,
    "feedback history present",
  );

  // Update feedback — events must not create duplicate evaluation records
  const updated = await submitAssistanceFeedback({
    assistanceId: gen.assistance.id,
    disposition: "accepted-with-edits",
    reason: "too-generic",
    note: "trimmed",
    actor: ACTOR,
  });
  assert(updated.success, "update feedback");
  const afterUpdate = await buildEvaluationRecord(gen.assistance.id);
  assert(
    afterUpdate?.feedback.disposition === "accepted-with-edits",
    "updated disposition",
  );
  assert(
    afterUpdate!.feedbackHistory.length >= 2,
    "history has create+update",
  );

  const dataset = await buildEvaluationDataset({}, 300);
  const matches = dataset.filter((r) => r.assistanceId === gen.assistance.id);
  assert(matches.length === 1, "no duplicate assistance in dataset");

  const analytics = await getAIQualityAnalytics({});
  assert(analytics.overview.feedbackCount >= 1, "analytics feedback count");
  assert(
    analytics.overview.coverage.total === analytics.overview.eligibleCount,
    "coverage denominator = eligible",
  );
  assert(
    analytics.metricDefinitions.coverage.includes("No-feedback"),
    "coverage definition",
  );

  // Rejected path
  const gen2 = await generateAssistance({
    entityType: "article",
    entityId: ARTICLE_ID,
    type: "content-improvement",
    createdBy: ACTOR,
  });
  assert(gen2.success, "second assistance");
  if (!gen2.success) throw new Error(gen2.message);
  await rejectAssistance(gen2.assistance.id, ACTOR);
  const rejectedFb = await submitAssistanceFeedback({
    assistanceId: gen2.assistance.id,
    disposition: "rejected",
    reason: "inaccurate",
    note: null,
    actor: ACTOR,
  });
  assert(rejectedFb.success, "rejected feedback");
  const notActionableGen = await generateAssistance({
    entityType: "article",
    entityId: ARTICLE_ID,
    type: "internal-link",
    createdBy: ACTOR,
  });
  assert(notActionableGen.success, "third assistance");
  if (!notActionableGen.success) throw new Error(notActionableGen.message);
  await rejectAssistance(notActionableGen.assistance.id, ACTOR);
  const na = await submitAssistanceFeedback({
    assistanceId: notActionableGen.assistance.id,
    disposition: "not-actionable",
    reason: "duplicate",
    note: null,
    actor: ACTOR,
  });
  assert(na.success, "not-actionable feedback");

  // Explicit task linkage via sourceType ai-assistance (direct create for test)
  const task = await createEditorialTask({
    entityType: "article",
    entityId: ARTICLE_ID,
    sourceType: "ai-assistance",
    sourceId: gen2.assistance.id,
    title: "Phase 46 task from assistance",
    createdBy: ACTOR,
  });
  assert(task.success, "create task with ai-assistance sourceType");

  const csv = buildEvaluationExportCsv(
    await buildEvaluationDataset({}, 300),
    "summary",
  );
  assert(csv.includes("assistance_id"), "csv header");
  assert(csv.includes(gen.assistance.id), "csv contains assistance");
  assert(!csv.toLowerCase().includes("training"), "no training terminology");

  const mat = await materializeEvaluationSnapshot(gen.assistance.id);
  assert(mat.success, "materialize snapshot");

  // Non-mutation: article title unchanged
  const article = await getAdminArticle(ARTICLE_ID);
  assert(
    article?.article.identity.title === "Phase 46 Evaluation Fixture",
    "evaluation does not mutate article",
  );

  await cleanup();
  await closeDb();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await cleanup().catch(() => undefined);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
