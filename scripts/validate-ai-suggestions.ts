/**
 * AI Suggestion validation (Phase 40).
 * Usage: npm run validate:ai-suggestions
 */
import "./load-env-local";
import fs from "fs";
import path from "path";
import {
  ALL_TARGET_FIELDS,
  APPLYABLE_TARGET_FIELDS,
  acceptSuggestion,
  buildMutationChangesFromSuggestion,
  createSuggestion,
  deleteAISuggestionsForEntityForTests,
  getPendingSuggestions,
  getSuggestionsForEntity,
  rejectSuggestion,
  validateCreateSuggestionInput,
} from "../src/lib/ai-suggestions";
import {
  createWorkflowRecord,
  deleteEditorialWorkflowForTests,
  submitForReview,
} from "../src/lib/editorial-workflow";
import {
  createAdminArticle,
  deleteAdminArticleRecord,
  getAdminArticle,
} from "../src/lib/admin/article-store";
import { blankArticleV1 } from "../src/lib/admin/blank-article";
import { countArticleRevisions } from "../src/lib/db/revisions";
import { closeDb } from "../src/lib/db/client";
import { isDatabaseContentStore } from "../src/lib/content/store-config";
import type { ArticleV1 } from "../src/types/article-v1";

const ARTICLE_ID = "zz-phase40-ai-suggestion";
const ARTICLE_SLUG = "zz-phase40-ai-suggestion";
const ACTOR = "phase40-ai@smartdesksetup.com";

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
  await deleteAISuggestionsForEntityForTests("article", ARTICLE_ID).catch(
    () => undefined,
  );
  await deleteEditorialWorkflowForTests("article", ARTICLE_ID).catch(
    () => undefined,
  );
  await deleteAdminArticleRecord(ARTICLE_ID, ARTICLE_SLUG).catch(() => undefined);
}

function testArticle(): ArticleV1 {
  return {
    ...blankArticleV1(),
    identity: {
      id: ARTICLE_ID,
      title: "Phase 40 AI Suggestion Fixture",
      slug: ARTICLE_SLUG,
    },
    classification: { type: "guide", category: "chairs" },
    editorial: {
      intent: "commercial",
      summary: "Before AI summary",
    },
    seo: {
      metaTitle: "Before meta title",
      metaDescription: "Before meta description",
    },
    publishing: { status: "draft" },
  };
}

async function main() {
  console.log("=== Foundation files ===");
  assertFile("src/types/ai-suggestion.ts");
  assertFile("src/lib/ai-suggestions.ts");
  assertFile("src/lib/ai-suggestions-store.ts");
  assertFile("drizzle/0003_ai_suggestions.sql");
  assertFile("src/app/dashboard/intelligence/ai/page.tsx");
  assertFile("src/components/intelligence/AISuggestionPanels.tsx");

  console.log("=== Pure: target fields ===");
  assert(APPLYABLE_TARGET_FIELDS.length >= 10, "applyable fields defined");
  assert(ALL_TARGET_FIELDS.length === APPLYABLE_TARGET_FIELDS.length + 2, "advisory fields");

  const invalidField = validateCreateSuggestionInput({
    entityType: "article",
    entityId: "x",
    suggestionType: "seo",
    targetField: "body.markdown",
    proposedValue: "hack",
    reasoning: "bad",
    createdBy: ACTOR,
  });
  assert(!invalidField.ok, "invalid target field rejected");

  const invalidType = validateCreateSuggestionInput({
    entityType: "article",
    entityId: "x",
    suggestionType: "auto-write",
    targetField: "seo.metaTitle",
    proposedValue: "Title",
    reasoning: "bad",
    createdBy: ACTOR,
  });
  assert(!invalidType.ok, "invalid suggestion type rejected");

  const validSeo = validateCreateSuggestionInput({
    entityType: "article",
    entityId: "x",
    suggestionType: "seo",
    targetField: "seo.metaTitle",
    proposedValue: "Best Office Chairs 2026",
    reasoning: "Improve CTR with year in title.",
    confidence: 82,
    createdBy: ACTOR,
  });
  assert(validSeo.ok, "valid SEO suggestion input");

  const changes = buildMutationChangesFromSuggestion({
    id: "test",
    entityType: "article",
    entityId: ARTICLE_ID,
    suggestionType: "seo",
    targetField: "seo.metaTitle",
    currentValue: "Before",
    proposedValue: "After",
    reasoning: "test",
    confidence: 80,
    status: "pending",
    createdBy: ACTOR,
    reviewedBy: null,
    reviewedAt: null,
    mutationRevisionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  assert(
    JSON.stringify(changes) === JSON.stringify({ seo: { metaTitle: "After" } }),
    "mutation changes from SEO suggestion",
  );

  const advisoryChanges = buildMutationChangesFromSuggestion({
    id: "test2",
    entityType: "article",
    entityId: ARTICLE_ID,
    suggestionType: "internal-link",
    targetField: "internal-link.relatedArticle",
    currentValue: null,
    proposedValue: "best-small-desks-apartments-2026",
    reasoning: "Link opportunity",
    confidence: 70,
    status: "pending",
    createdBy: ACTOR,
    reviewedBy: null,
    reviewedAt: null,
    mutationRevisionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  assert(advisoryChanges === null, "advisory suggestion has no mutation changes");

  console.log("=== Empty-safe resolvers ===");
  const queue = await getPendingSuggestions(10);
  assert(Array.isArray(queue.items), "pending queue items");
  assert(typeof queue.pendingCount === "number", "pending queue count");

  if (!isDatabaseContentStore()) {
    console.log("\nSKIP integration: CONTENT_STORE is not database");
    console.log(`\nResults: ${passed} passed, ${failed} failed (partial)`);
    if (failed > 0) process.exit(1);
    console.log("AI suggestions validation passed (pure + empty-safe).");
    return;
  }

  ensureActorAdmin();
  console.log("=== Integration: create / accept / reject ===");
  await cleanup();

  try {
    const created = await createAdminArticle(testArticle(), {
      body: "# Phase 40 fixture\n",
    });
    assert(created.ok, "fixture article create");

    const beforeRevCount = await countArticleRevisions(ARTICLE_ID);

    const suggestion = await createSuggestion({
      entityType: "article",
      entityId: ARTICLE_ID,
      suggestionType: "seo",
      targetField: "seo.metaTitle",
      currentValue: "Before meta title",
      proposedValue: "Best Office Chairs 2026",
      reasoning: "Add year for freshness signal.",
      confidence: 85,
      createdBy: ACTOR,
    });
    assert(suggestion.success, "create suggestion");
    const suggestionId = suggestion.success ? suggestion.suggestion.id : "";

    const entitySuggestions = await getSuggestionsForEntity("article", ARTICLE_ID);
    assert(
      entitySuggestions.some((s) => s.id === suggestionId && s.status === "pending"),
      "entity suggestions include pending",
    );

    const queueAfter = await getPendingSuggestions(20);
    assert(
      queueAfter.items.some((s) => s.id === suggestionId),
      "pending queue includes suggestion",
    );

    const record = await getAdminArticle(ARTICLE_ID);
    const accepted = await acceptSuggestion({
      suggestionId,
      actor: ACTOR,
      expectedVersion: record!.version ?? 1,
    });
    assert(accepted.success, "accept suggestion through mutation boundary");
    if (accepted.success) {
      assert(
        accepted.suggestion.status === "accepted",
        "suggestion marked accepted",
      );
      assert(Boolean(accepted.revisionId), "revision created on accept");
    }

    const afterArticle = await getAdminArticle(ARTICLE_ID);
    assert(
      afterArticle?.article.seo?.metaTitle === "Best Office Chairs 2026",
      "article metaTitle updated via mutation boundary",
    );

    const afterRevCount = await countArticleRevisions(ARTICLE_ID);
    assert(afterRevCount > beforeRevCount, "revision count increased");

    const rejectSuggestionResult = await createSuggestion({
      entityType: "article",
      entityId: ARTICLE_ID,
      suggestionType: "editorial",
      targetField: "editorial.summary",
      currentValue: afterArticle?.article.editorial.summary ?? null,
      proposedValue: "Rejected summary proposal",
      reasoning: "Test reject path.",
      confidence: 60,
      createdBy: ACTOR,
    });
    assert(rejectSuggestionResult.success, "second suggestion for reject test");
    if (rejectSuggestionResult.success) {
      const rejected = await rejectSuggestion({
        suggestionId: rejectSuggestionResult.suggestion.id,
        actor: ACTOR,
      });
      assert(rejected.success, "reject suggestion");
      assert(
        rejected.success && rejected.suggestion.status === "rejected",
        "rejected status preserved in history",
      );
    }

    const history = await getSuggestionsForEntity("article", ARTICLE_ID);
    assert(
      history.some((s) => s.status === "accepted") &&
        history.some((s) => s.status === "rejected"),
      "accept and reject history both visible",
    );

    console.log("=== Integration: workflow lock on accept ===");
    await createWorkflowRecord({
      entityType: "article",
      entityId: ARTICLE_ID,
      actor: ACTOR,
    });
    await submitForReview({
      entityType: "article",
      entityId: ARTICLE_ID,
      actor: ACTOR,
    });

    const lockedSuggestion = await createSuggestion({
      entityType: "article",
      entityId: ARTICLE_ID,
      suggestionType: "seo",
      targetField: "seo.metaDescription",
      currentValue: "Before meta description",
      proposedValue: "Locked should fail",
      reasoning: "Workflow lock test.",
      confidence: 50,
      createdBy: ACTOR,
    });
    assert(lockedSuggestion.success, "locked suggestion create");
    if (lockedSuggestion.success) {
      const lockedAccept = await acceptSuggestion({
        suggestionId: lockedSuggestion.suggestion.id,
        actor: ACTOR,
        expectedVersion: (await getAdminArticle(ARTICLE_ID))!.version ?? 1,
      });
      assert(
        !lockedAccept.success &&
          lockedAccept.error === "MUTATION_FAILED",
        "workflow lock blocks accept mutation",
      );
    }
  } finally {
    await cleanup();
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("AI suggestions validation passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb().catch(() => undefined);
  });
