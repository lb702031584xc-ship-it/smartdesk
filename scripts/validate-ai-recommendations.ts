/**
 * AI Recommendation validation (Phase 41).
 * Usage: npm run validate:ai-recommendations
 */
import "./load-env-local";
import fs from "fs";
import path from "path";
import {
  buildAllRecommendations,
  buildRecommendationScore,
  getRecommendationsForEntity,
  getTopRecommendations,
  priorityFromScore,
} from "../src/lib/ai-recommendations";
import {
  getEntityRecommendations,
  getRecommendationQueue,
} from "../src/lib/ai-recommendation-resolver";
import {
  createSuggestion,
  deleteAISuggestionsForEntityForTests,
} from "../src/lib/ai-suggestions";
import {
  createAdminArticle,
  deleteAdminArticleRecord,
} from "../src/lib/admin/article-store";
import { blankArticleV1 } from "../src/lib/admin/blank-article";
import { closeDb } from "../src/lib/db/client";
import { isDatabaseContentStore } from "../src/lib/content/store-config";
import type { ArticleV1 } from "../src/types/article-v1";

const ARTICLE_ID = "zz-phase41-recommendation";
const ARTICLE_SLUG = "zz-phase41-recommendation";
const ACTOR = "phase41-rec@smartdesksetup.com";

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
  await deleteAdminArticleRecord(ARTICLE_ID, ARTICLE_SLUG).catch(() => undefined);
}

function testArticle(): ArticleV1 {
  return {
    ...blankArticleV1(),
    identity: {
      id: ARTICLE_ID,
      slug: ARTICLE_SLUG,
      title: "Phase 41 Recommendation Fixture",
    },
    classification: { type: "guide", category: "chairs" },
    editorial: {
      intent: "commercial",
      summary: "Phase 41 fixture summary",
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
  console.log("=== Phase 41 file presence ===");
  assertFile("src/types/ai-recommendation.ts");
  assertFile("src/lib/ai-recommendations.ts");
  assertFile("src/lib/ai-recommendation-resolver.ts");
  assertFile("src/components/intelligence/AIRecommendationPanels.tsx");
  assertFile("src/app/dashboard/intelligence/recommendations/page.tsx");

  console.log("\n=== Pure: scoring transparency ===");
  const highScore = buildRecommendationScore({
    recommendationType: "content-coverage",
    signals: [
      { label: "product-without-article", weight: 65 },
      { label: "commerce-value", weight: 15 },
    ],
    commerceValue: 10,
  });
  assert(highScore.priorityScore >= 75, "high commerce gap scores high");
  assert(highScore.priority === "high", "priority band high");
  assert(highScore.reason.length > 0, "reason is non-empty");

  const lowScore = buildRecommendationScore({
    recommendationType: "internal-linking",
    signals: [{ label: "internal-link-opportunity", weight: 20 }],
  });
  assert(lowScore.priority === "low", "low signal scores low priority");
  assert(priorityFromScore(75) === "high", "priorityFromScore high threshold");
  assert(priorityFromScore(45) === "medium", "priorityFromScore medium threshold");
  assert(priorityFromScore(44) === "low", "priorityFromScore low threshold");

  console.log("\n=== Pure: priority ordering ===");
  const ordered = [
    buildRecommendationScore({
      recommendationType: "topic-expansion",
      signals: [{ label: "thin-topic", weight: 50 }],
    }),
    buildRecommendationScore({
      recommendationType: "content-coverage",
      signals: [
        { label: "product-without-article", weight: 65 },
        { label: "commerce-value", weight: 15 },
      ],
    }),
  ].sort((a, b) => b.priorityScore - a.priorityScore);
  assert(
    ordered[0]!.priorityScore >= ordered[1]!.priorityScore,
    "scores sort descending",
  );

  console.log("\n=== Corpus: recommendation generation ===");
  const { items: all } = await buildAllRecommendations();
  assert(Array.isArray(all), "buildAllRecommendations returns array");
  for (const item of all.slice(0, 5)) {
    assert(item.id.startsWith("rec:"), `id prefix rec: (${item.id})`);
    assert(item.reason.length > 0, `reason present (${item.id})`);
    assert(item.signals.length > 0, `signals present (${item.id})`);
    assert(
      ["high", "medium", "low"].includes(item.priority),
      `valid priority (${item.id})`,
    );
    assert(item.status === "open", `status open (${item.id})`);
  }

  const top = await getTopRecommendations(10);
  assert(top.length <= 10, "getTopRecommendations respects limit");
  if (top.length >= 2) {
    assert(
      top[0]!.priorityScore >= top[1]!.priorityScore,
      "top recommendations sorted by score",
    );
  }

  const queue = await getRecommendationQueue(20);
  assert(queue.totalCount === queue.items.length, "queue count matches items");
  assert(
    queue.highCount + queue.mediumCount + queue.lowCount === queue.totalCount,
    "priority counts sum to total",
  );

  console.log("\n=== Entity resolution ===");
  const missing = await getEntityRecommendations("article", "missing-phase41-id");
  assert(Array.isArray(missing), "missing entity returns array");
  assert(missing.length === 0, "missing entity returns empty");

  if (all.length > 0) {
    const sample = all.find((r) => r.entityType === "article");
    if (sample) {
      const entityRecs = await getRecommendationsForEntity(
        "article",
        sample.entityId,
      );
      assert(
        entityRecs.every(
          (r) =>
            (r.entityType === "article" && r.entityId === sample.entityId) ||
            r.recommendationType === "internal-linking",
        ),
        "entity filter matches article",
      );
    }
  }

  if (!isDatabaseContentStore()) {
    console.log("\n=== DB tests skipped (filesystem store) ===");
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
    return;
  }

  console.log("\n=== DB: suggestion linkage (no mutation) ===");
  ensureActorAdmin();
  await cleanup();
  const articleCreated = await createAdminArticle(testArticle(), {
    body: "# Phase 41 fixture\n",
  });
  assert(articleCreated.ok, "fixture article create");

  const created = await createSuggestion({
    entityType: "article",
    entityId: ARTICLE_ID,
    suggestionType: "seo",
    targetField: "seo.metaDescription",
    currentValue: "Fixture description",
    proposedValue: "Improved meta description for fixture",
    reasoning: "SEO improvement opportunity",
    confidence: 82,
    createdBy: ACTOR,
  });
  assert(created.success, "create suggestion");
  const suggestionId = created.success ? created.suggestion.id : "";

  const entityRecs = await getEntityRecommendations("article", ARTICLE_ID);
  const seoRec = entityRecs.find((r) => r.suggestionId === suggestionId);
  assert(!!seoRec, "SEO recommendation links to suggestion");
  assert(seoRec?.recommendationType === "seo-improvement", "seo type");
  assert(seoRec?.suggestionId === suggestionId, "suggestionId preserved");

  const { getAdminArticle } = await import("../src/lib/admin/article-store");
  const after = await getAdminArticle(ARTICLE_ID);
  assert(
    after?.article.seo?.metaDescription === "Fixture description",
    "no direct write from recommendations",
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
