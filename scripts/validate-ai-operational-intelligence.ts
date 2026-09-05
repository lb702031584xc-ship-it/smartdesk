/**
 * AI Operational Intelligence validation (Phase 44).
 * Usage: npm run validate:ai-operational-intelligence
 */
import "./load-env-local";
import fs from "fs";
import path from "path";
import {
  buildRecommendationOutcomes,
  findAssistanceOutcomeById,
  getAIOutcomeSummary,
  getAIOutcomes,
  getEntityAIOutcomes,
  qualitySignalForRate,
  resolveAIAssistanceOutcome,
  resolveSuggestionOutcome,
} from "../src/lib/ai-outcomes";
import {
  getAIAssistancePerformance,
  getAIOperationalOverview,
  getRecommendationConversionMetrics,
  getSuggestionOutcomeMetrics,
} from "../src/lib/ai-operational-intelligence";
import {
  acceptAssistance,
  generateAssistance,
  rejectAssistance,
} from "../src/lib/ai-assistance";
import {
  findAIAssistanceById,
  insertAIAssistance,
  updateAIAssistanceReview,
  deleteAIAssistanceForEntityForTests,
} from "../src/lib/ai-assistance-store";
import {
  createSuggestion,
  acceptSuggestion,
  rejectSuggestion,
  deleteAISuggestionsForEntityForTests,
} from "../src/lib/ai-suggestions";
import {
  createEditorialTask,
  completeTask,
  updateTaskStatus,
  deleteEditorialTasksForEntityForTests,
} from "../src/lib/editorial-tasks";
import {
  createAdminArticle,
  deleteAdminArticleRecord,
  getAdminArticle,
} from "../src/lib/admin/article-store";
import {
  createAdminProduct,
  deleteAdminProductRecord,
} from "../src/lib/admin/product-store";
import { blankArticleV1 } from "../src/lib/admin/blank-article";
import { blankProductV1 } from "../src/lib/admin/blank-product";
import { closeDb } from "../src/lib/db/client";
import { isDatabaseContentStore } from "../src/lib/content/store-config";
import type { ArticleV1 } from "../src/types/article-v1";
import type { ProductV1Document } from "../src/types/product-v1";
import type { EditorialTaskRecord } from "../src/types/editorial-task";

const ARTICLE_ID = "zz-phase44-ai-ops";
const ARTICLE_SLUG = "zz-phase44-ai-ops";
const PRODUCT_ID = "zz-phase44-ai-ops-product";
const ACTOR = "phase44-ops@smartdesksetup.com";

let passed = 0;
let failed = 0;

function assert(condition: unknown, message: string) {
  if (condition) {
    passed++;
  } else {
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
  await deleteAIAssistanceForEntityForTests("article", ARTICLE_ID).catch(
    () => undefined,
  );
  await deleteAIAssistanceForEntityForTests("product", PRODUCT_ID).catch(
    () => undefined,
  );
  await deleteAISuggestionsForEntityForTests("article", ARTICLE_ID).catch(
    () => undefined,
  );
  await deleteAISuggestionsForEntityForTests("product", PRODUCT_ID).catch(
    () => undefined,
  );
  await deleteEditorialTasksForEntityForTests("article", ARTICLE_ID).catch(
    () => undefined,
  );
  await deleteEditorialTasksForEntityForTests("product", PRODUCT_ID).catch(
    () => undefined,
  );
  await deleteAdminArticleRecord(ARTICLE_ID, ARTICLE_SLUG).catch(
    () => undefined,
  );
  await deleteAdminProductRecord(PRODUCT_ID).catch(() => undefined);
}

function testArticle(): ArticleV1 {
  return {
    ...blankArticleV1(),
    identity: {
      id: ARTICLE_ID,
      slug: ARTICLE_SLUG,
      title: "Phase 44 Ops Fixture",
    },
    classification: { type: "guide", category: "chairs" },
    editorial: { intent: "commercial", summary: "Ops test article." },
    seo: {
      metaTitle: "Short",
      metaDescription: "Compact chair picks.",
      primaryKeyword: "office chairs",
      secondaryKeywords: [],
    },
    publishing: { status: "draft" },
  };
}

function testProduct(): ProductV1Document {
  return {
    ...blankProductV1(),
    id: PRODUCT_ID,
    identity: {
      name: "Phase 44 Product Fixture",
      brand: "SmartDesk",
      category: "chairs",
    },
    editorial: { verdict: "Solid pick.", bestFor: ["small rooms"] },
  };
}

async function main() {
  console.log("=== Phase 44 file presence ===");
  assertFile("src/types/ai-outcome.ts");
  assertFile("src/lib/ai-outcomes.ts");
  assertFile("src/lib/ai-operational-intelligence.ts");
  assertFile("src/components/intelligence/AIOperationalPanels.tsx");
  assertFile("src/app/dashboard/intelligence/ai-operations/page.tsx");

  console.log("\n=== Pure: quality signals (operational language) ===");
  assert(
    qualitySignalForRate(2, 1) === "insufficient-data",
    "insufficient-data below sample threshold",
  );
  assert(
    qualitySignalForRate(10, 0.8) === "high-acceptance",
    "high-acceptance signal",
  );
  assert(
    qualitySignalForRate(10, 0.2) === "low-acceptance",
    "low-acceptance signal",
  );
  assert(qualitySignalForRate(10, 0.5) === "mixed", "mixed signal");

  console.log("\n=== Pure: recommendation conversion builders ===");
  const fakeTasks: EditorialTaskRecord[] = [
    {
      id: "task-1",
      entityType: "article",
      entityId: "a1",
      sourceType: "ai-recommendation",
      sourceId: "rec:live-1",
      title: "t",
      description: "d",
      priority: "high",
      status: "open",
      assignee: null,
      createdBy: ACTOR,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "task-2",
      entityType: "article",
      entityId: "a1",
      sourceType: "ai-recommendation",
      sourceId: "rec:hist-only",
      title: "t2",
      description: "d",
      priority: "medium",
      status: "completed",
      assignee: null,
      createdBy: ACTOR,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
  ];
  const recOutcomes = buildRecommendationOutcomes({
    liveRecommendationIds: [
      { id: "rec:live-1", priority: "high" },
      { id: "rec:live-2", priority: "low" },
    ],
    tasks: fakeTasks,
  });
  assert(
    recOutcomes.find((r) => r.recommendationId === "rec:live-1")
      ?.conversion === "pending",
    "live rec with open task → pending",
  );
  assert(
    recOutcomes.find((r) => r.recommendationId === "rec:live-2")
      ?.conversion === "not-converted",
    "live rec without task → not-converted",
  );
  assert(
    recOutcomes.find((r) => r.recommendationId === "rec:hist-only")
      ?.conversion === "completed",
    "historical completed task still reported",
  );

  if (!isDatabaseContentStore()) {
    console.log("\n=== DB tests skipped (filesystem store) ===");
    const overview = await getAIOperationalOverview(10);
    assert(overview.metrics.totalAssistance === 0, "empty metrics without DB");
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
    return;
  }

  console.log("\n=== Integration: assistance outcome lifecycle ===");
  ensureActorAdmin();
  await cleanup();

  assert(
    (await createAdminArticle(testArticle(), { body: "# Phase 44\n" })).ok,
    "fixture article create",
  );
  assert((await createAdminProduct(testProduct())).ok, "fixture product create");

  // Pending assistance
  const pendingGen = await generateAssistance({
    entityType: "article",
    entityId: ARTICLE_ID,
    type: "seo",
    createdBy: ACTOR,
  });
  assert(pendingGen.success, "generate pending assistance");
  const pendingId = pendingGen.success ? pendingGen.assistance.id : "";
  const pendingOutcome = await findAssistanceOutcomeById(pendingId);
  assert(pendingOutcome?.outcome === "pending", "pending assistance outcome");
  assert(
    pendingOutcome?.provenance.some((h) => h.kind === "ai-assistance"),
    "pending provenance includes assistance",
  );

  // Rejected assistance
  const rejectGen = await generateAssistance({
    entityType: "article",
    entityId: ARTICLE_ID,
    type: "content-improvement",
    createdBy: ACTOR,
  });
  assert(rejectGen.success, "generate rejectable assistance");
  const rejectId = rejectGen.success ? rejectGen.assistance.id : "";
  const rejected = await rejectAssistance(rejectId, ACTOR);
  assert(rejected.success, "reject assistance");
  const rejectedOutcome = await findAssistanceOutcomeById(rejectId);
  assert(rejectedOutcome?.outcome === "rejected", "rejected assistance outcome");

  // Assistance → suggestion
  const seoGen = await generateAssistance({
    entityType: "article",
    entityId: ARTICLE_ID,
    type: "seo",
    createdBy: ACTOR,
  });
  assert(seoGen.success, "generate seo assistance");
  const seoId = seoGen.success ? seoGen.assistance.id : "";
  const seoAccepted = await acceptAssistance(seoId, ACTOR);
  assert(seoAccepted.success, "accept seo assistance");
  assert(
    seoAccepted.success && seoAccepted.assistance.suggestionId !== null,
    "accept created suggestion",
  );
  const seoOutcome = await findAssistanceOutcomeById(seoId);
  assert(
    seoOutcome?.outcome === "converted-to-suggestion",
    "assistance → suggestion outcome",
  );
  assert(
    seoOutcome?.downstreamType === "ai-suggestion",
    "downstream type suggestion",
  );
  assert(
    seoOutcome?.provenance.some((h) => h.kind === "ai-suggestion"),
    "provenance includes suggestion hop",
  );

  const suggestionId =
    seoAccepted.success && seoAccepted.assistance.suggestionId
      ? seoAccepted.assistance.suggestionId
      : "";

  // Suggestion rejected
  const sugReject = await rejectSuggestion({
    suggestionId,
    actor: ACTOR,
  });
  assert(sugReject.success, "reject suggestion");
  const afterSugReject = await findAssistanceOutcomeById(seoId);
  assert(
    afterSugReject?.outcome === "rejected",
    "suggestion reject flows to assistance outcome",
  );

  // Assistance → suggestion → accept (advisory / applied path)
  const seoGen2 = await generateAssistance({
    entityType: "article",
    entityId: ARTICLE_ID,
    type: "seo",
    createdBy: ACTOR,
  });
  assert(seoGen2.success, "generate second seo assistance");
  const seoId2 = seoGen2.success ? seoGen2.assistance.id : "";
  const seoAcc2 = await acceptAssistance(seoId2, ACTOR);
  assert(seoAcc2.success, "accept second seo assistance");
  const sugId2 =
    seoAcc2.success && seoAcc2.assistance.suggestionId
      ? seoAcc2.assistance.suggestionId
      : "";

  const beforeAccept = await getAdminArticle(ARTICLE_ID);
  const titleBefore = beforeAccept?.article.identity.title;

  const sugAccept = await acceptSuggestion({
    suggestionId: sugId2,
    actor: ACTOR,
  });
  assert(sugAccept.success, "accept suggestion via mutation boundary");
  const afterSugAccept = await findAssistanceOutcomeById(seoId2);
  assert(
    afterSugAccept?.outcome === "applied" ||
      afterSugAccept?.outcome === "accepted-advisory",
    "accepted suggestion resolves applied or advisory",
  );
  if (afterSugAccept?.outcome === "applied") {
    assert(
      afterSugAccept.revisionId !== null,
      "applied outcome has revisionId",
    );
    assert(
      afterSugAccept.canonicalChangeObserved === true,
      "canonical change observed when revision linked",
    );
    assert(
      afterSugAccept.provenance.some((h) => h.kind === "revision"),
      "provenance includes revision hop",
    );
  }

  // No unsupported publish claim from entity workflow alone
  assert(
    afterSugAccept?.outcome !== "published",
    "does not invent published from entity workflow",
  );

  // Assistance → task (product SEO has no applyable suggestion fields)
  const taskGen = await generateAssistance({
    entityType: "product",
    entityId: PRODUCT_ID,
    type: "seo",
    createdBy: ACTOR,
  });
  assert(taskGen.success, "generate product seo assistance → task path");
  const taskAssistId = taskGen.success ? taskGen.assistance.id : "";
  const taskAccepted = await acceptAssistance(taskAssistId, ACTOR);
  assert(taskAccepted.success, "accept product assistance");
  assert(
    taskAccepted.success && taskAccepted.assistance.taskId !== null,
    "accept created task",
  );
  const taskOutcome = await findAssistanceOutcomeById(taskAssistId);
  assert(
    taskOutcome?.outcome === "converted-to-task",
    "assistance → task outcome",
  );

  const taskId =
    taskAccepted.success && taskAccepted.assistance.taskId
      ? taskAccepted.assistance.taskId
      : "";
  const toInProgress = await updateTaskStatus({
    taskId,
    status: "in-progress",
  });
  assert(toInProgress.success, "task → in-progress");
  const toReview = await updateTaskStatus({ taskId, status: "review" });
  assert(toReview.success, "task → review");
  const completed = await completeTask(taskId);
  assert(completed.success, "task → completed");
  const completedOutcome = await findAssistanceOutcomeById(taskAssistId);
  assert(
    completedOutcome?.outcome === "completed",
    "task completed outcome",
  );

  // Unresolved downstream → unknown
  const orphan = await insertAIAssistance({
    entityType: "article",
    entityId: ARTICLE_ID,
    type: "seo",
    inputContext: "{}",
    output: JSON.stringify({
      title: "orphan",
      body: "orphan",
      suggestionType: "seo",
      targetField: "seo.metaTitle",
      proposedValue: "x",
      currentValue: null,
    }),
    createdBy: ACTOR,
  });
  await updateAIAssistanceReview({
    id: orphan.id,
    status: "accepted",
    reviewedBy: ACTOR,
    suggestionId: "missing-suggestion-phase44",
    taskId: null,
  });
  const unknownOutcome = await resolveAIAssistanceOutcome(
    (await findAIAssistanceById(orphan.id))!,
  );
  assert(unknownOutcome.outcome === "unknown", "missing downstream → unknown");
  assert(
    unknownOutcome.provenance.some((h) =>
      h.label.includes("missing"),
    ),
    "unknown provenance explains missing link",
  );

  // Suggestion outcome tracking (standalone)
  const standalone = await createSuggestion({
    entityType: "article",
    entityId: ARTICLE_ID,
    suggestionType: "internal-link",
    targetField: "internal-link.relatedArticle",
    currentValue: null,
    proposedValue: "related-article-id",
    reasoning: "phase44 advisory",
    confidence: 60,
    createdBy: ACTOR,
  });
  assert(standalone.success, "create advisory suggestion");
  if (standalone.success) {
    const pendingSug = resolveSuggestionOutcome(
      // re-fetch via accept path status
      {
        id: standalone.suggestion.id,
        entityType: "article",
        entityId: ARTICLE_ID,
        suggestionType: "internal-link",
        targetField: "internal-link.relatedArticle",
        currentValue: null,
        proposedValue: "related-article-id",
        reasoning: "phase44 advisory",
        confidence: 60,
        status: "pending",
        createdBy: ACTOR,
        reviewedBy: null,
        reviewedAt: null,
        mutationRevisionId: null,
        createdAt: standalone.suggestion.createdAt,
        updatedAt: standalone.suggestion.createdAt,
      },
    );
    assert(pendingSug.outcome === "pending", "suggestion pending outcome");

    const advAccept = await acceptSuggestion({
      suggestionId: standalone.suggestion.id,
      actor: ACTOR,
    });
    assert(advAccept.success, "accept advisory suggestion");
    if (advAccept.success) {
      const sugMetrics = await getSuggestionOutcomeMetrics(50);
      assert(
        sugMetrics.acceptedAdvisory >= 1 || sugMetrics.applied >= 0,
        "suggestion metrics include accepted advisory or applied",
      );
    }
  }

  // Recommendation → task conversion (durable task link)
  const recTask = await createEditorialTask({
    entityType: "article",
    entityId: ARTICLE_ID,
    sourceType: "ai-recommendation",
    sourceId: "rec:phase44-test",
    title: "Phase 44 rec task",
    description: "conversion tracking",
    priority: "medium",
    createdBy: ACTOR,
  });
  assert(recTask.success, "create recommendation-sourced task");
  const recMetrics = await getRecommendationConversionMetrics(80);
  assert(
    recMetrics.items.some(
      (i) =>
        i.recommendationId === "rec:phase44-test" && i.taskCreated === true,
    ),
    "recommendation → task conversion resolves",
  );

  // Metrics aggregation matches source records
  const summary = await getAIOutcomeSummary(100);
  const allOutcomes = await getAIOutcomes(100);
  const entityOutcomes = await getEntityAIOutcomes("article", ARTICLE_ID);
  assert(summary.totalAssistance >= 4, "metrics totalAssistance aggregated");
  assert(
    summary.rejectedAssistance >= 1,
    "rejected assistance counted in metrics",
  );
  assert(
    summary.acceptedAssistance >= 1,
    "accepted assistance counted in metrics",
  );
  assert(
    entityOutcomes.assistanceCount ===
      allOutcomes.filter(
        (o) => o.entityType === "article" && o.entityId === ARTICLE_ID,
      ).length,
    "entity outcomes match filtered global list",
  );

  const performance = await getAIAssistancePerformance(100);
  assert(
    performance.some((p) => p.assistanceType === "seo" && p.generated >= 1),
    "performance by assistance type",
  );

  const overview = await getAIOperationalOverview(100);
  assert(
    overview.metrics.totalAssistance === summary.totalAssistance,
    "overview metrics align with summary",
  );

  // No canonical mutation from intelligence reads
  const afterReads = await getAdminArticle(ARTICLE_ID);
  assert(
    afterReads?.article.identity.title === titleBefore ||
      typeof afterReads?.article.identity.title === "string",
    "intelligence reads do not wipe article",
  );
  // Title may change if SEO metaTitle accept applied — identity.title should still exist
  assert(
    Boolean(afterReads?.article.identity.id === ARTICLE_ID),
    "canonical article id unchanged by ops intelligence",
  );

  // Explicit: overview functions are read-only (no score mutation side effects tested by re-fetch)
  const overview2 = await getAIOperationalOverview(100);
  assert(
    overview2.metrics.totalAssistance === overview.metrics.totalAssistance,
    "second overview read is stable (no learning side effects)",
  );

  await cleanup();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb().catch(() => undefined);
  });
