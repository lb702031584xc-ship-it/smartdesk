/**
 * Editorial Task validation (Phase 42).
 * Usage: npm run validate:editorial-tasks
 */
import "./load-env-local";
import fs from "fs";
import path from "path";
import {
  assignTask,
  completeTask,
  createEditorialTask,
  createTaskFromRecommendation,
  createTaskFromSuggestion,
  deleteEditorialTasksForEntityForTests,
  getEntityTasks,
  getTaskQueue,
  isValidTaskTransition,
  updateTaskStatus,
  validateCreateTaskInput,
} from "../src/lib/editorial-tasks";
import { buildAllRecommendations } from "../src/lib/ai-recommendations";
import {
  createSuggestion,
  deleteAISuggestionsForEntityForTests,
} from "../src/lib/ai-suggestions";
import {
  createAdminArticle,
  deleteAdminArticleRecord,
  getAdminArticle,
} from "../src/lib/admin/article-store";
import { blankArticleV1 } from "../src/lib/admin/blank-article";
import { closeDb } from "../src/lib/db/client";
import { isDatabaseContentStore } from "../src/lib/content/store-config";
import type { ArticleV1 } from "../src/types/article-v1";

const ARTICLE_ID = "zz-phase42-editorial-task";
const ARTICLE_SLUG = "zz-phase42-editorial-task";
const ACTOR = "phase42-task@smartdesksetup.com";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
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
  await deleteEditorialTasksForEntityForTests("article", ARTICLE_ID).catch(
    () => undefined,
  );
  await deleteAISuggestionsForEntityForTests("article", ARTICLE_ID).catch(
    () => undefined,
  );
  await deleteAdminArticleRecord(ARTICLE_ID, ARTICLE_SLUG).catch(() => undefined);
}

function testArticle(): ArticleV1 {
  return {
    ...blankArticleV1(),
    identity: {
      id: ARTICLE_ID,
      slug: ARTICLE_SLUG,
      title: "Phase 42 Task Fixture",
    },
    classification: { type: "guide", category: "chairs" },
    editorial: {
      intent: "commercial",
      summary: "Phase 42 fixture summary",
    },
    seo: {
      metaTitle: "Fixture title",
      metaDescription: "Fixture description",
      primaryKeyword: "fixture",
      secondaryKeywords: [],
    },
    publishing: { status: "draft" },
  };
}

async function main() {
  console.log("=== Phase 42 file presence ===");
  assertFile("src/types/editorial-task.ts");
  assertFile("src/lib/editorial-tasks.ts");
  assertFile("src/lib/editorial-tasks-store.ts");
  assertFile("drizzle/0004_editorial_tasks.sql");
  assertFile("src/components/editorial/EditorialTaskPanels.tsx");
  assertFile("src/app/dashboard/editorial/tasks/page.tsx");

  console.log("\n=== Pure: status transitions ===");
  assert(isValidTaskTransition("open", "in-progress"), "open → in-progress");
  assert(isValidTaskTransition("in-progress", "review"), "in-progress → review");
  assert(isValidTaskTransition("review", "completed"), "review → completed");
  assert(!isValidTaskTransition("open", "completed"), "open ↛ completed");
  assert(!isValidTaskTransition("completed", "open"), "completed terminal");

  const invalid = validateCreateTaskInput({
    entityType: "article",
    entityId: "",
    sourceType: "manual",
    title: "x",
    createdBy: ACTOR,
  });
  assert(!invalid.ok, "empty entityId rejected");

  if (!isDatabaseContentStore()) {
    console.log("\n=== DB tests skipped (filesystem store) ===");
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
    return;
  }

  console.log("\n=== Integration: task lifecycle ===");
  ensureActorAdmin();
  await cleanup();

  const created = await createAdminArticle(testArticle(), {
    body: "# Phase 42 fixture\n",
  });
  assert(created.ok, "fixture article create");

  const manual = await createEditorialTask({
    entityType: "article",
    entityId: ARTICLE_ID,
    sourceType: "manual",
    title: "Manual follow-up",
    description: "Operator-created task",
    priority: "medium",
    createdBy: ACTOR,
  });
  assert(manual.success, "create manual task");
  const taskId = manual.success ? manual.task.id : "";

  const entityTasks = await getEntityTasks("article", ARTICLE_ID);
  assert(
    entityTasks.some((t) => t.id === taskId && t.status === "open"),
    "entity tasks include open task",
  );

  const assigned = await assignTask({
    taskId,
    assignee: ACTOR,
  });
  assert(assigned.success && assigned.task.assignee === ACTOR, "assign task");

  const started = await updateTaskStatus({
    taskId,
    status: "in-progress",
  });
  assert(started.success && started.task.status === "in-progress", "start task");

  const inReview = await updateTaskStatus({ taskId, status: "review" });
  assert(inReview.success && inReview.task.status === "review", "review task");

  const badTransition = await updateTaskStatus({ taskId, status: "open" });
  assert(!badTransition.success, "invalid transition rejected");

  console.log("\n=== Recommendation → task conversion ===");
  const { items: recs } = await buildAllRecommendations();
  const sampleRec = recs.find(
    (r) => r.entityType === "article" && r.entityId === ARTICLE_ID,
  );
  if (sampleRec) {
    const fromRec = await createTaskFromRecommendation({
      recommendationId: sampleRec.id,
      createdBy: ACTOR,
    });
    assert(fromRec.success, "create task from recommendation");
    assert(
      fromRec.success && fromRec.task.sourceType === "ai-recommendation",
      "source type ai-recommendation",
    );
    assert(
      fromRec.success && fromRec.task.sourceId === sampleRec.id,
      "sourceId links recommendation",
    );
  } else {
    const fallbackRec = recs[0];
    if (fallbackRec) {
      const fromRec = await createTaskFromRecommendation({
        recommendationId: fallbackRec.id,
        createdBy: ACTOR,
      });
      assert(fromRec.success, "create task from any recommendation");
    }
  }

  console.log("\n=== Suggestion → task conversion ===");
  const suggestion = await createSuggestion({
    entityType: "article",
    entityId: ARTICLE_ID,
    suggestionType: "seo",
    targetField: "seo.metaDescription",
    currentValue: "Fixture description",
    proposedValue: "Improved meta",
    reasoning: "SEO task fixture",
    confidence: 80,
    createdBy: ACTOR,
  });
  assert(suggestion.success, "create suggestion");
  const suggestionId = suggestion.success ? suggestion.suggestion.id : "";

  const fromSuggestion = await createTaskFromSuggestion({
    suggestionId,
    createdBy: ACTOR,
  });
  assert(fromSuggestion.success, "create task from suggestion");
  assert(
    fromSuggestion.success &&
      fromSuggestion.task.sourceType === "ai-suggestion",
    "source type ai-suggestion",
  );

  console.log("\n=== Completion does not mutate content ===");
  const completed = await completeTask(taskId);
  assert(completed.success && completed.task.status === "completed", "complete");

  const after = await getAdminArticle(ARTICLE_ID);
  assert(
    after?.article.seo?.metaDescription === "Fixture description",
    "no canonical write on task complete",
  );

  const missingEntity = await createEditorialTask({
    entityType: "article",
    entityId: "missing-phase42-article",
    sourceType: "manual",
    title: "Bad entity",
    createdBy: ACTOR,
  });
  assert(!missingEntity.success, "invalid entity rejected");

  const queue = await getTaskQueue(50);
  assert(queue.items.length > 0, "task queue has items");
  assert(
    queue.openCount + queue.inProgressCount + queue.reviewCount + queue.completedCount <=
      queue.items.length,
    "queue counts consistent",
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
