/**
 * Phase 29 — Native ArticleV1 renderer validation + legacy parity.
 *
 * Run: npm run validate:article-renderer
 *
 * Migration test article: best-office-chairs-small-spaces-2026
 */
import "./load-env-local";
import {
  buildArticleViewModel,
  buildArticleViewModelBySlug,
  buildArticleMetadataFromViewModel,
  getArticleRendererMode,
  seoParitySnapshotFromMeta,
  seoParitySnapshotFromView,
  shouldUseNativeArticleRenderer,
  viewModelToLegacyResolvedArticle,
} from "../src/lib/article-renderer";
import {
  getResolvedArticleSync,
  getArticleBySlugSync,
} from "../src/lib/articles";
import { buildArticleMetadata, buildArticleJsonLd } from "../src/lib/seo";
import { listFilesystemArticlesV1 } from "../src/lib/content/filesystem-articles";
import { listFilesystemProductsV1 } from "../src/lib/content/filesystem-products";
import { articleV1ToLegacyMeta } from "../src/lib/article-schema";
import type { ArticleV1 } from "../src/types/article-v1";

const PARITY_SLUG = "best-office-chairs-small-spaces-2026";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) passed++;
  else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main() {
  console.log("=== Feature flag ===");
  assert(getArticleRendererMode() === "legacy" || getArticleRendererMode() === "native", "mode is legacy|native");
  // Default without env override should be legacy (unless operator set native)
  if (!process.env.ARTICLE_RENDERER_MODE) {
    assert(getArticleRendererMode() === "legacy", "default mode is legacy");
    assert(!shouldUseNativeArticleRenderer(PARITY_SLUG), "default does not force native for parity slug");
  }

  console.log("=== ViewModel pipeline ===");
  const products = listFilesystemProductsV1();
  const articles = listFilesystemArticlesV1();
  const chairs = articles.find((a) => a.identity.slug === PARITY_SLUG);
  assert(Boolean(chairs), `parity article ${PARITY_SLUG} exists on filesystem`);

  if (!chairs) {
    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    process.exit(1);
  }

  // Body from filesystem article loader
  const { getFilesystemArticleV1 } = await import("../src/lib/content/filesystem-articles");
  const record = getFilesystemArticleV1(PARITY_SLUG);
  assert(Boolean(record?.body), "markdown body present");

  const view = buildArticleViewModel(chairs, record!.body, {
    articles,
    products,
    requireProducts: true,
  });

  assert(view.article.identity.slug === PARITY_SLUG, "view slug");
  assert(view.publishing.status === "published", "publishing status published");
  assert(view.seo.metaTitle.length > 0, "seo metaTitle");
  assert(view.seo.metaDescription.length > 0, "seo metaDescription");
  assert(view.contentHtml.length > 0, "contentHtml from markdown");
  assert(view.body.length > 0, "markdown body preserved");
  assert(view.products.length >= 1, "products resolved");
  assert(
    view.products.every((p) => p.product.id && p.product.identity.name),
    "products are ProductV1 documents",
  );
  assert(
    !JSON.stringify(view.products).includes('"amazonUrl":') ||
      view.products.every((p) => p.product.commerce?.amazonUrl),
    "commerce lives on ProductV1",
  );

  console.log("=== Missing product fails clearly ===");
  let missingThrew = false;
  try {
    buildArticleViewModel(
      {
        ...chairs,
        products: {
          primary: [{ productId: "does-not-exist-product", rank: 1 }],
        },
      } as ArticleV1,
      record!.body,
      { articles, products, requireProducts: true },
    );
  } catch (error) {
    missingThrew = String(error).includes("does-not-exist-product") || String(error).includes("Missing products");
  }
  assert(missingThrew, "missing product throws clear error");

  console.log(`=== Legacy vs native parity (${PARITY_SLUG}) ===`);
  const legacyResolved = getResolvedArticleSync(PARITY_SLUG);
  const legacyMeta = getArticleBySlugSync(PARITY_SLUG);
  const nativeAsLegacy = viewModelToLegacyResolvedArticle(view);

  assert(legacyResolved.title === view.article.identity.title, "title parity");
  assert(legacyResolved.slug === view.article.identity.slug, "slug parity");
  assert(
    deepEqual(
      legacyResolved.productIds.slice().sort(),
      view.products.map((p) => p.product.id).sort(),
    ),
    "product id set parity",
  );
  assert(
    legacyResolved.resolvedProducts.length === nativeAsLegacy.resolvedProducts.length,
    "resolved product count parity",
  );
  assert(
    deepEqual(
      legacyResolved.resolvedProducts.map((p) => p.id),
      nativeAsLegacy.resolvedProducts.map((p) => p.id),
    ),
    "resolved product order parity",
  );

  const legacySeo = seoParitySnapshotFromMeta(legacyMeta);
  const nativeSeo = seoParitySnapshotFromView(view);
  assert(deepEqual(legacySeo, nativeSeo), `SEO snapshot parity\nlegacy=${JSON.stringify(legacySeo)}\nnative=${JSON.stringify(nativeSeo)}`);

  const legacyMetadata = buildArticleMetadata(legacyMeta);
  const nativeMetadata = buildArticleMetadataFromViewModel(view);
  assert(legacyMetadata.title === nativeMetadata.title, "Metadata.title parity");
  assert(legacyMetadata.description === nativeMetadata.description, "Metadata.description parity");
  assert(
    JSON.stringify(legacyMetadata.alternates) === JSON.stringify(nativeMetadata.alternates),
    "Metadata.canonical parity",
  );
  assert(
    JSON.stringify(legacyMetadata.robots) === JSON.stringify(nativeMetadata.robots),
    "Metadata.robots parity",
  );

  const legacyJsonLd = buildArticleJsonLd(legacyResolved);
  const nativeJsonLd = buildArticleJsonLd(nativeAsLegacy);
  assert(
    JSON.stringify(legacyJsonLd) === JSON.stringify(nativeJsonLd),
    "JSON-LD schema parity",
  );

  // Store path also works when DB configured
  try {
    const storeView = await buildArticleViewModelBySlug(PARITY_SLUG);
    assert(storeView.article.identity.slug === PARITY_SLUG, "store slug load");
    assert(storeView.products.length === view.products.length, "store product count");
  } catch (error) {
    // Filesystem-only CI may still succeed via getArticleV1BySlug
    console.warn(`[article-renderer] store load note: ${String(error)}`);
  }

  console.log("=== Adapter still works ===");
  const adapted = articleV1ToLegacyMeta(chairs);
  assert(adapted.slug === PARITY_SLUG, "legacy adapter unchanged");

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("Article renderer validation passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
