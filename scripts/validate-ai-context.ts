/**
 * AI Context validation (Phase 43).
 * Usage: npm run validate:ai-context
 */
import "./load-env-local";
import fs from "fs";
import path from "path";
import {
  buildArticleAIContext,
  buildProductAIContext,
  serializeAIPromptContext,
} from "../src/lib/ai-context";
import {
  ASSISTANCE_TYPES,
  draftAssistanceFromContext,
  generateAssistance,
  getAssistanceForEntity,
  getAssistanceQueue,
  rejectAssistance,
  acceptAssistance,
} from "../src/lib/ai-assistance";
import { deleteAIAssistanceForEntityForTests } from "../src/lib/ai-assistance-store";
import {
  createAdminArticle,
  deleteAdminArticleRecord,
} from "../src/lib/admin/article-store";
import {
  createAdminProduct,
  deleteAdminProductRecord,
} from "../src/lib/admin/product-store";
import { blankArticleV1 } from "../src/lib/admin/blank-article";
import { blankProductV1 } from "../src/lib/admin/blank-product";
import { closeDb } from "../src/lib/db/client";
import { isDatabaseContentStore } from "../src/lib/content/store-config";
import { deleteAISuggestionsForEntityForTests } from "../src/lib/ai-suggestions";
import { deleteEditorialTasksForEntityForTests } from "../src/lib/editorial-tasks";
import type { ArticleV1 } from "../src/types/article-v1";
import type { ProductV1Document } from "../src/types/product-v1";

const ARTICLE_ID = "zz-phase43-ai-context";
const ARTICLE_SLUG = "zz-phase43-ai-context";
const PRODUCT_ID = "zz-phase43-ai-context-product";
const ACTOR = "phase43-ai@smartdesksetup.com";

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
  await deleteAIAssistanceForEntityForTests("article", ARTICLE_ID).catch(() => undefined);
  await deleteAIAssistanceForEntityForTests("product", PRODUCT_ID).catch(() => undefined);
  await deleteAISuggestionsForEntityForTests("article", ARTICLE_ID).catch(() => undefined);
  await deleteEditorialTasksForEntityForTests("article", ARTICLE_ID).catch(() => undefined);
  await deleteAdminArticleRecord(ARTICLE_ID, ARTICLE_SLUG).catch(() => undefined);
  await deleteAdminProductRecord(PRODUCT_ID).catch(() => undefined);
}

function testArticle(): ArticleV1 {
  return {
    ...blankArticleV1(),
    identity: { id: ARTICLE_ID, slug: ARTICLE_SLUG, title: "Phase 43 Context Fixture" },
    classification: { type: "guide", category: "chairs" },
    editorial: { intent: "commercial", summary: "Small space seating guide." },
    seo: {
      metaTitle: "Best Office Chairs",
      metaDescription: "Compact chair picks for small spaces.",
      primaryKeyword: "office chairs small spaces",
      secondaryKeywords: [],
    },
    publishing: { status: "draft" },
  };
}

function testProduct(): ProductV1Document {
  return {
    ...blankProductV1(),
    id: PRODUCT_ID,
    identity: { name: "Phase 43 Product Fixture", brand: "SmartDesk", category: "chairs" },
    editorial: { verdict: "Solid compact pick.", bestFor: ["small rooms"] },
  };
}

async function main() {
  console.log("=== Phase 43 file presence ===");
  assertFile("src/types/ai-context.ts");
  assertFile("src/types/ai-assistance.ts");
  assertFile("src/lib/ai-context.ts");
  assertFile("src/lib/ai-assistance.ts");
  assertFile("src/lib/ai-assistance-store.ts");
  assertFile("drizzle/0005_ai_assistance_outputs.sql");
  assertFile("src/components/intelligence/AIAssistancePanels.tsx");
  assertFile("src/app/dashboard/intelligence/ai-assistance/page.tsx");

  console.log("\n=== Pure: assistance type registry ===");
  assert(ASSISTANCE_TYPES.includes("seo"), "seo type registered");
  assert(ASSISTANCE_TYPES.includes("content-improvement"), "content-improvement registered");
  assert(ASSISTANCE_TYPES.includes("product-editorial"), "product-editorial registered");
  assert(ASSISTANCE_TYPES.includes("internal-link"), "internal-link registered");

  if (!isDatabaseContentStore()) {
    console.log("\n=== DB tests skipped (filesystem store) ===");

    // Pure corpus context tests (no DB writes needed for this part)
    console.log("\n=== Pure: filesystem context builder ===");
    const fsArticleContext = await buildArticleAIContext(
      "best-office-chairs-small-spaces-2026",
    ).catch(() => null);
    if (fsArticleContext) {
      assert(fsArticleContext.entityType === "article", "article context type");
      assert(fsArticleContext.entity.name.length > 0, "article context name");
      assert(Array.isArray(fsArticleContext.intelligenceSignals), "signals array");
      assert(Array.isArray(fsArticleContext.relatedProducts), "relatedProducts array");
      const serialized = serializeAIPromptContext(fsArticleContext);
      assert(serialized.includes("entityType"), "serialized context includes entityType");

      const draft = draftAssistanceFromContext(fsArticleContext, "seo");
      assert(draft.title.length > 0, "draft title present");
      assert(draft.body.length > 0, "draft body present");

      const draftContent = draftAssistanceFromContext(fsArticleContext, "content-improvement");
      assert(draftContent.title.length > 0, "content draft title present");
    } else {
      console.log("  article not found in filesystem corpus — skipping context assertions");
    }

    const fsProductContext = await buildProductAIContext("single-monitor-arm").catch(() => null);
    if (fsProductContext) {
      assert(fsProductContext.entityType === "product", "product context type");
      const draft = draftAssistanceFromContext(fsProductContext, "product-editorial");
      assert(draft.title.length > 0, "product draft title");
    }

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
    return;
  }

  console.log("\n=== Integration: context + assistance lifecycle ===");
  ensureActorAdmin();
  await cleanup();

  const articleCreated = await createAdminArticle(testArticle(), {
    body: "# Phase 43 fixture\n",
  });
  assert(articleCreated.ok, "fixture article create");

  const productCreated = await createAdminProduct(testProduct());
  assert(productCreated.ok, "fixture product create");

  // Context resolution
  const articleContext = await buildArticleAIContext(ARTICLE_ID);
  assert(articleContext !== null, "article context resolves");
  assert(articleContext?.entityType === "article", "article entityType");
  assert(articleContext?.entity.name === "Phase 43 Context Fixture", "article entity name");
  assert(
    articleContext?.entity.seo.primaryKeyword === "office chairs small spaces",
    "seo primaryKeyword in context",
  );
  assert(Array.isArray(articleContext?.intelligenceSignals), "signals array");

  const productContext = await buildProductAIContext(PRODUCT_ID);
  assert(productContext !== null, "product context resolves");
  assert(productContext?.entityType === "product", "product entityType");
  assert(productContext?.entity.editorial.verdict !== null, "verdict in context");

  // Serialization
  const serialized = serializeAIPromptContext(articleContext!);
  assert(typeof serialized === "string", "serialized is string");
  assert(serialized.includes("entityType"), "serialized includes entityType");
  assert(!serialized.includes('"body"'), "serialized does not include full Markdown body");

  // No canonical mutation from context building
  const { getAdminArticle } = await import("../src/lib/admin/article-store");
  const afterContext = await getAdminArticle(ARTICLE_ID);
  assert(
    afterContext?.article.identity.title === "Phase 43 Context Fixture",
    "article unchanged after context build",
  );

  console.log("\n=== Integration: assistance generate / review ===");

  const genResult = await generateAssistance({
    entityType: "article",
    entityId: ARTICLE_ID,
    type: "seo",
    createdBy: ACTOR,
  });
  assert(genResult.success, "generate seo assistance");
  const assistId = genResult.success ? genResult.assistance.id : "";
  assert(
    genResult.success && genResult.assistance.status === "draft",
    "assistance starts as draft",
  );
  assert(genResult.success && genResult.assistance.draft !== null, "draft payload parsed");

  const entityAssistance = await getAssistanceForEntity("article", ARTICLE_ID);
  assert(entityAssistance.some((a) => a.id === assistId), "assistance in entity list");

  // Reject path — preserves history
  const rejectResult = await rejectAssistance(assistId, ACTOR);
  assert(rejectResult.success, "reject assistance");
  assert(
    rejectResult.success && rejectResult.assistance.status === "rejected",
    "status rejected",
  );

  // Generate another, then accept
  const gen2 = await generateAssistance({
    entityType: "article",
    entityId: ARTICLE_ID,
    type: "content-improvement",
    createdBy: ACTOR,
  });
  assert(gen2.success, "generate content-improvement assistance");
  const assist2Id = gen2.success ? gen2.assistance.id : "";

  const acceptResult = await acceptAssistance(assist2Id, ACTOR);
  assert(acceptResult.success, "accept assistance");
  assert(
    acceptResult.success && acceptResult.assistance.status === "accepted",
    "status accepted after accept",
  );

  // Accept must route to suggestion or task
  const linkedSuggestionId = acceptResult.success
    ? acceptResult.assistance.suggestionId
    : null;
  const linkedTaskId = acceptResult.success ? acceptResult.assistance.taskId : null;
  assert(
    linkedSuggestionId !== null || linkedTaskId !== null,
    "accept routes to suggestion or task",
  );

  // No canonical writes
  const afterAssist = await getAdminArticle(ARTICLE_ID);
  assert(
    afterAssist?.article.identity.title === "Phase 43 Context Fixture",
    "no canonical write from assistance accept",
  );

  // Queue
  const queue = await getAssistanceQueue(20);
  assert(typeof queue.draftCount === "number", "queue has counts");
  assert(Array.isArray(queue.pendingReview), "queue pendingReview array");

  // Missing entity
  const missingContext = await buildArticleAIContext("missing-phase43-entity");
  assert(missingContext === null, "missing entity returns null context");

  const missingGen = await generateAssistance({
    entityType: "article",
    entityId: "missing-phase43-entity",
    type: "seo",
    createdBy: ACTOR,
  });
  assert(!missingGen.success, "missing entity rejected for assistance");

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
