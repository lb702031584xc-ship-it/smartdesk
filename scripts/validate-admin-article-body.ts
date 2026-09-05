/**
 * Durable Markdown body editor checks: load, save, reload, reset semantics, concurrency.
 */
import fs from "fs";
import path from "path";
import {
  createAdminArticle,
  getAdminArticle,
  listAdminArticles,
  listAdminProducts,
  saveAdminArticle,
} from "../src/lib/admin";
import { articleBodyChangeLine } from "../src/lib/admin/article-body";
import { deleteAdminArticleRecord } from "../src/lib/admin/article-store";
import { articleLocalHints } from "../src/lib/admin/local-hints";
import { articleMarkdownExists } from "../src/lib/content/article-markdown";
import { isDatabaseContentStore } from "../src/lib/content/store-config";
import { renderArticleMarkdown } from "../src/lib/markdown/render-article-body";
import { closeDb } from "../src/lib/db/client";
import type { ArticleV1 } from "../src/types/article-v1";

const TEST_ID = "zz-admin-body-editor-test";
const TEST_SLUG = "zz-admin-body-editor-test";

const SAMPLE_MARKDOWN = `# Test heading

**Bold** text and a [link](https://example.com).

- item one
- item two

| Col | Value |
| --- | ----- |
| A | 1 |
`;

function fail(message: string): never {
  console.error(`[admin-article-body] ${message}`);
  process.exit(1);
}

function assert(condition: boolean, message: string) {
  if (!condition) fail(message);
}

function testArticle(): ArticleV1 {
  return {
    identity: {
      id: TEST_ID,
      title: "Admin Body Editor Test",
      slug: TEST_SLUG,
    },
    classification: {
      type: "guide",
    },
    editorial: {
      intent: "informational",
    },
    publishing: {
      status: "draft",
      featured: false,
    },
  };
}

async function cleanup() {
  const existing = await getAdminArticle(TEST_ID);
  if (existing || articleMarkdownExists(TEST_SLUG)) {
    await deleteAdminArticleRecord(TEST_ID, TEST_SLUG).catch(async () => {
      const mdPath = path.join(process.cwd(), "content/posts", `${TEST_SLUG}.md`);
      if (fs.existsSync(mdPath)) fs.unlinkSync(mdPath);
    });
  }
}

async function main() {
  if (!isDatabaseContentStore()) {
    fail("CONTENT_STORE=database is required for Article body validation.");
  }

  await cleanup();

  const articlesBefore = await listAdminArticles();
  const productsBefore = await listAdminProducts();
  assert(articlesBefore.length === 12, `expected 12 articles before test, got ${articlesBefore.length}`);
  assert(productsBefore.length === 13, `expected 13 products, got ${productsBefore.length}`);

  const created = await createAdminArticle(testArticle());
  assert(created.ok, "create draft for body test must succeed");

  const loaded = await getAdminArticle(TEST_ID);
  assert(Boolean(loaded), "created article must load");
  assert(loaded!.body === "", "new article body must start empty");
  assert(typeof loaded!.version === "number", "version must be present");

  const emptyPublishedHint = articleLocalHints(
    {
      ...testArticle(),
      publishing: { status: "published", featured: false },
    },
    { mode: "edit", body: "" },
  );
  assert(
    emptyPublishedHint.errors.some((error) => error.includes("Markdown body")),
    "published empty body should error",
  );

  const bodyLine = articleBodyChangeLine("", SAMPLE_MARKDOWN);
  assert(Boolean(bodyLine), "body change summary should detect Markdown edits");
  assert(bodyLine!.section === "Article Body", "body change section label");
  assert(bodyLine!.detail.includes("Markdown body changed"), "body change detail");

  const html = renderArticleMarkdown(SAMPLE_MARKDOWN);
  assert(html.includes("<h1>") || html.includes("<h1 "), "preview pipeline should render heading");
  assert(html.includes("<strong>") || html.includes("<b>"), "preview pipeline should render bold");
  assert(html.includes("<li>"), "preview pipeline should render list");
  assert(html.includes("<table>") || html.includes("<th>"), "GFM table should render");

  const version1 = loaded!.version!;
  const saved = await saveAdminArticle(loaded!.article, {
    expectedVersion: version1,
    body: SAMPLE_MARKDOWN,
  });
  assert(saved.ok, "body save must succeed");
  assert(typeof saved.version === "number" && saved.version === version1 + 1, "version must bump");

  const reloaded = await getAdminArticle(TEST_ID);
  assert(reloaded?.body === SAMPLE_MARKDOWN, "reload must return saved Neon body");

  const mdPath = path.join(process.cwd(), "content/posts", `${TEST_SLUG}.md`);
  const mdBefore = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, "utf8") : "";
  const savedAgain = await saveAdminArticle(reloaded!.article, {
    expectedVersion: reloaded!.version,
    body: `${SAMPLE_MARKDOWN}\n\nExtra paragraph.`,
  });
  assert(savedAgain.ok, "second body save must succeed");
  const mdAfter = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, "utf8") : "";
  assert(mdBefore === mdAfter, "database Admin save must not rewrite repository Markdown");

  const stale = await saveAdminArticle(reloaded!.article, {
    expectedVersion: version1,
    body: "stale overwrite attempt",
  });
  assert(!stale.ok, "stale body save must be rejected");
  assert(
    stale.errors.some((error) => error.toLowerCase().includes("changed after you opened")),
    "stale save should use concurrency message",
  );

  const afterStale = await getAdminArticle(TEST_ID);
  assert(
    afterStale?.body === `${SAMPLE_MARKDOWN}\n\nExtra paragraph.`,
    "stale save must not overwrite newer body",
  );

  await cleanup();

  const articlesAfter = await listAdminArticles();
  const productsAfter = await listAdminProducts();
  assert(articlesAfter.length === 12, `articles restored to 12, got ${articlesAfter.length}`);
  assert(productsAfter.length === 13, `products unchanged at 13, got ${productsAfter.length}`);
  assert(!articleMarkdownExists(TEST_SLUG), "test markdown pointer must be cleaned up");

  await closeDb();
  console.log("[admin-article-body] DB body load: PASS");
  console.log("[admin-article-body] DB body save: PASS");
  console.log("[admin-article-body] DB body reload: PASS");
  console.log("[admin-article-body] Stale body save: PASS");
  console.log("[admin-article-body] Repo Markdown untouched: PASS");
  console.log("[admin-article-body] Admin preview pipeline: PASS");
  console.log("[admin-article-body] Cleanup: PASS");
}

main().catch(async (error) => {
  console.error(error);
  await cleanup().catch(() => undefined);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
