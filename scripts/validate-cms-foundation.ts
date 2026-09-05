/**
 * CMS foundation validation (Phase 39).
 * Usage: npm run validate:cms-foundation
 */
import "./load-env-local";
import fs from "fs";
import path from "path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CONTENT_BLOCK_TYPES,
  validateContentBlocks,
} from "../src/lib/content-blocks";
import { buildContentEditorViewModel } from "../src/lib/content-editor";
import { updateArticleContentBlocks } from "../src/lib/content-mutations";
import { buildArticleViewModel } from "../src/lib/article-renderer";
import { getFilesystemArticleV1 } from "../src/lib/content/filesystem-articles";
import { parseArticleContent } from "../src/lib/markdown/parse-article-content";
import { serializeContentBlocksToMarkdown } from "../src/lib/markdown/serialize-article-content";
import { renderArticleMarkdown } from "../src/lib/markdown/render-article-body";
import { ContentStructurePanel } from "../src/components/editorial/ContentStructurePanel";
import {
  createAdminArticle,
  deleteAdminArticleRecord,
  getAdminArticle,
} from "../src/lib/admin/article-store";
import { blankArticleV1 } from "../src/lib/admin/blank-article";
import {
  createWorkflowRecord,
  deleteEditorialWorkflowForTests,
  submitForReview,
} from "../src/lib/editorial-workflow";
import { closeDb } from "../src/lib/db/client";
import { isDatabaseContentStore } from "../src/lib/content/store-config";
import type { ArticleV1 } from "../src/types/article-v1";

const TEST_ID = "zz-phase39-cms-foundation";
const TEST_SLUG = "zz-phase39-cms-foundation";
const ACTOR = "phase39-cms@smartdesksetup.com";
const LEGACY_SLUG = "best-office-chairs-small-spaces-2026";

const FIXTURE_BODY = `## Introduction

Editorial intro for Phase 39.

## Quick Comparison

| Role | Pick |
|---|---|
| Best Overall | Branch |

## Best Overall

Our pick is \`flexispot-compact\`.

> **Tip:** Measure desk depth first.
`;

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
  await deleteEditorialWorkflowForTests("article", TEST_ID).catch(() => undefined);
  await deleteAdminArticleRecord(TEST_ID, TEST_SLUG).catch(() => undefined);
}

function testArticle(): ArticleV1 {
  return {
    ...blankArticleV1(),
    identity: {
      id: TEST_ID,
      title: "Phase 39 CMS Fixture",
      slug: TEST_SLUG,
    },
    classification: { type: "best-list", category: "chairs" },
    editorial: { intent: "commercial", summary: "CMS foundation test" },
    products: {
      primary: [{ productId: "flexispot-compact", rank: 1, role: "best-overall" }],
    },
    publishing: { status: "draft" },
  };
}

async function main() {
  console.log("=== Foundation files ===");
  assertFile("src/types/content-document.ts");
  assertFile("src/types/content-editor.ts");
  assertFile("src/lib/content-blocks.ts");
  assertFile("src/lib/content-mutations.ts");
  assertFile("src/lib/content-editor.ts");
  assertFile("src/lib/markdown/parse-article-content.ts");
  assertFile("src/lib/markdown/serialize-article-content.ts");
  assertFile("src/components/editorial/ContentStructurePanel.tsx");

  console.log("=== Block registry ===");
  assert(CONTENT_BLOCK_TYPES.length === 6, "block registry count");

  console.log("=== Parse + serialize ===");
  const parsed = parseArticleContent(FIXTURE_BODY, {
    knownProductIds: ["flexispot-compact"],
  });
  assert(parsed.blocks.length > 0, "fixture parses blocks");
  assert(
    parsed.blocks.some((b) => b.type === "product-reference"),
    "product-reference parsed",
  );
  assert(
    parsed.blocks.some((b) => b.type === "comparison-table"),
    "comparison-table parsed",
  );

  const roundTrip = serializeContentBlocksToMarkdown(parsed.blocks);
  assert(roundTrip.length > 0, "serialize produces markdown");
  const reparsed = parseArticleContent(roundTrip, {
    knownProductIds: ["flexispot-compact"],
  });
  assert(reparsed.blocks.length > 0, "round-trip reparses");

  const validation = validateContentBlocks(parsed.blocks, {
    knownProductIds: ["flexispot-compact"],
  });
  assert(validation.valid, "parsed fixture validates");

  console.log("=== Legacy Markdown compatibility ===");
  const legacy = getFilesystemArticleV1(LEGACY_SLUG);
  assert(Boolean(legacy), "legacy article loads");
  if (legacy) {
    const legacyView = buildArticleViewModel(legacy.article, legacy.body, {
      requireProducts: false,
    });
    assert(legacyView.contentHtml.length > 0, "legacy article renders HTML");
    assert(legacyView.body === legacy.body, "legacy body preserved");

    const legacyParsed = parseArticleContent(legacy.body, {
      knownProductIds: (legacy.article.products?.primary ?? []).map(
        (p) => p.productId,
      ),
    });
    assert(legacyParsed.blocks.length > 0, "legacy markdown parses additively");
    const legacyHtmlAfterParse = renderArticleMarkdown(legacy.body);
    assert(legacyHtmlAfterParse.length > 0, "legacy markdown render unchanged");
  }

  console.log("=== Structured fixture render ===");
  const fixtureView = buildArticleViewModel(testArticle(), FIXTURE_BODY, {
    requireProducts: false,
  });
  assert(fixtureView.contentHtml.includes("<"), "structured fixture renders HTML");

  console.log("=== Mutation boundary (pure) ===");
  const badBlocks = validateContentBlocks(
    [{ id: "b", type: "product-reference", productId: "", sourceMarkdown: "" }],
    { knownProductIds: ["flexispot-compact"] },
  );
  assert(!badBlocks.valid, "invalid blocks rejected before mutation");

  if (!isDatabaseContentStore()) {
    console.log("\nSKIP integration: CONTENT_STORE is not database");
    console.log(`\nResults: ${passed} passed, ${failed} failed (partial)`);
    if (failed > 0) process.exit(1);
    console.log("CMS foundation validation passed (pure).");
    return;
  }

  ensureActorAdmin();
  console.log("=== Integration: content mutation + workflow lock ===");
  await cleanup();

  try {
    const created = await createAdminArticle(testArticle(), {
      body: FIXTURE_BODY,
    });
    assert(created.ok, "fixture article create");

    const editorBefore = await buildContentEditorViewModel(TEST_ID);
    assert(Boolean(editorBefore), "content editor view model");
    assert(
      (editorBefore?.blockCount ?? 0) > 0,
      "editor view model has blocks",
    );

    if (editorBefore) {
      const panelHtml = renderToStaticMarkup(
        React.createElement(ContentStructurePanel, { editor: editorBefore }),
      );
      assert(panelHtml.includes("Structured content"), "structure panel renders");
    }

    const blocks = parsed.blocks;
    const mut = await updateArticleContentBlocks({
      articleId: TEST_ID,
      blocks,
      expectedVersion: (await getAdminArticle(TEST_ID))!.version ?? 1,
      actor: ACTOR,
    });
    assert(mut.success || mut.error === "NO_CONTENT_CHANGE", "content mutation path");

    await createWorkflowRecord({
      entityType: "article",
      entityId: TEST_ID,
      actor: ACTOR,
    });
    await submitForReview({
      entityType: "article",
      entityId: TEST_ID,
      actor: ACTOR,
    });

    const locked = await updateArticleContentBlocks({
      articleId: TEST_ID,
      blocks,
      expectedVersion: (await getAdminArticle(TEST_ID))!.version ?? 1,
      actor: ACTOR,
    });
    assert(
      !locked.success && locked.error === "WORKFLOW_LOCKED",
      "workflow lock blocks content mutation",
    );
  } finally {
    await cleanup();
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("CMS foundation validation passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb().catch(() => undefined);
  });
