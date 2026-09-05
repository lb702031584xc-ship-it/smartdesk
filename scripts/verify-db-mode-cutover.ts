/**
 * Phase 13B database-mode cutover verification.
 */
import {
  getContentStoreMode,
  isDatabaseContentStore,
} from "../src/lib/content/store-config";
import {
  getArticleV1,
  listArticleV1Ids,
  listArticlesV1,
} from "../src/lib/content/articles";
import {
  getProductV1,
  listProductV1Ids,
  listProductsV1,
} from "../src/lib/content/products";
import { listDatabaseProductIds } from "../src/lib/content/database-products";
import {
  getAdminArticle,
  getAdminProduct,
  getAdminWriteMode,
  listAdminArticles,
  listAdminProducts,
  saveAdminArticle,
  saveAdminProduct,
  validateAdminArticleSave,
  validateAdminProductSave,
} from "../src/lib/admin";
import {
  getAllArticles,
  getArticleBySlug,
  getArticleSlugs,
  getFeaturedArticles,
  getFeaturedArticlesSync,
  getResolvedArticle,
  getResolvedArticleSync,
} from "../src/lib/articles";
import { getAllProducts, getProductById } from "../src/lib/products";
import { listDatabaseArticleIds } from "../src/lib/content/database-articles";
import { listFilesystemArticleIds } from "../src/lib/content/filesystem-articles";
import { listFilesystemProductIds } from "../src/lib/content/filesystem-products";
import { buildArticleMetadata } from "../src/lib/seo";
import { siteConfig } from "../src/lib/site";
import { closeDb } from "../src/lib/db/client";
import type { ArticleV1 } from "../src/types/article-v1";
import type { ProductV1Document } from "../src/types/product-v1";
import type { ResolvedArticle } from "../src/types/article";
import type { ResolvedProduct } from "../src/types/product";

function fail(message: string): never {
  console.error(`[db-cutover] ${message}`);
  process.exit(1);
}

function assert(condition: boolean, message: string) {
  if (!condition) fail(message);
}

function maskError(error: unknown): string {
  return String(error instanceof Error ? error.message : error).replace(
    /postgresql:\/\/[^@]+@/g,
    "postgresql://***@",
  );
}

function withAffiliateTag(url: string): string {
  const parsed = new URL(url);
  if (!parsed.searchParams.has("tag")) {
    parsed.searchParams.set("tag", siteConfig.affiliateTag);
  }
  return parsed.toString();
}

function productParityKey(product: ResolvedProduct) {
  return {
    id: product.id,
    name: product.name,
    image: product.image,
    rating: product.rating,
    priceRange: product.priceRange,
    priceLabel: product.priceLabel,
    amazonUrl: product.amazonUrl,
    rank: product.rank,
    badge: product.badge,
    verdict: product.verdict,
    bestFor: product.bestFor,
    summary: product.summary,
    pros: product.pros,
    cons: product.cons,
  };
}

function articleRuntimeKey(article: ResolvedArticle) {
  return {
    slug: article.slug,
    type: article.type,
    title: article.title,
    seoTitle: article.seoTitle,
    description: article.description,
    seoCanonical: article.seoCanonical,
    noindex: article.noindex ?? false,
    featured: article.featured === true,
    winnerId: article.winnerId,
    comparisonRows: article.comparisonRows,
    ratingCategories: article.ratingCategories,
    productRefs: article.productRefs,
    products: article.resolvedProducts.map(productParityKey),
  };
}

function uniqueOrFail(ids: string[], label: string) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) fail(`duplicate ${label}: ${id}`);
    seen.add(id);
  }
}

async function main() {
  assert(getContentStoreMode() === "database", "CONTENT_STORE must be database");
  assert(isDatabaseContentStore(), "isDatabaseContentStore() must be true");
  assert(getAdminWriteMode() === "database", "Admin write mode must be database");

  console.log("[db-cutover] Article store: database");
  console.log("[db-cutover] Product store: database");
  console.log("[db-cutover] Admin store: database");

  const productIds = await listProductV1Ids();
  const articleIds = await listArticleV1Ids();
  uniqueOrFail(productIds, "Product ID");
  uniqueOrFail(articleIds, "Article ID");
  assert(productIds.length === 13, `Expected 13 products, got ${productIds.length}`);
  assert(articleIds.length === 12, `Expected 12 articles, got ${articleIds.length}`);

  const products = await listProductsV1();
  const articles = await listArticlesV1();
  uniqueOrFail(
    articles.map((a) => a.identity.slug),
    "slug",
  );
  assert(products.length === 13, "listProductsV1 length");
  assert(articles.length === 12, "listArticlesV1 length");
  const dbProductIds = await listDatabaseProductIds();
  const dbArticleIds = await listDatabaseArticleIds();
  assert(
    JSON.stringify(dbProductIds) === JSON.stringify(productIds),
    "Unified Product store IDs must equal database Product IDs",
  );
  assert(
    JSON.stringify(dbArticleIds) === JSON.stringify(articleIds),
    "Unified Article store IDs must equal database Article IDs",
  );
  const fsProductIds = listFilesystemProductIds();
  const fsArticleIds = listFilesystemArticleIds();
  assert(fsProductIds.length === 13, "filesystem still has 13 products as reference");
  assert(fsArticleIds.length === 12, "filesystem still has 12 articles as reference");
  console.log("[db-cutover] duplicate Product IDs: 0");
  console.log("[db-cutover] duplicate Article IDs: 0");
  console.log("[db-cutover] duplicate slugs: 0");

  const dbProduct = await getProductV1("flexispot-compact");
  const dbArticle = await getArticleV1("flexispot-compact-standing-desk-review");
  assert(typeof dbProduct?.version === "number", "Product record must expose DB version");
  assert(typeof dbArticle?.version === "number", "Article record must expose DB version");

  const slugs = await getArticleSlugs();
  assert(slugs.length === 12, `Article routes expected 12, got ${slugs.length}`);
  const publicArticles = await getAllArticles();
  assert(publicArticles.length === 12, `Public articles expected 12, got ${publicArticles.length}`);
  const publicProducts = await getAllProducts();
  assert(publicProducts.length === 13, `Public products expected 13, got ${publicProducts.length}`);

  const representatives: Record<string, "best" | "review" | "comparison" | "guide"> = {
    "best-office-chairs-small-spaces-2026": "best",
    "best-standing-desks-small-apartments": "best",
    "best-monitor-setup-small-home-office": "best",
    "flexispot-compact-standing-desk-review": "review",
    "standing-desk-vs-writing-desk": "comparison",
    "single-vs-dual-monitor-arm": "comparison",
    "40-inch-desk-setup": "guide",
  };

  for (const [slug, type] of Object.entries(representatives)) {
    const article = await getArticleBySlug(slug);
    assert(article.type === type, `${slug} type expected ${type}, got ${article.type}`);
    assert(Boolean(article.contentHtml.trim()), `${slug} body missing`);
  }

  assert(Boolean(await getProductById("flexispot-compact")), "desk product missing");
  assert(Boolean(await getProductById("branch-ergonomic-chair")), "chair product missing");
  assert(Boolean(await getProductById("monitor-arm-dual")), "accessory product missing");

  let missingRefs = 0;
  for (const article of articles) {
    for (const ref of article.products?.primary ?? []) {
      if (!(await getProductV1(ref.productId))) missingRefs += 1;
    }
  }
  assert(missingRefs === 0, `Missing Product references: ${missingRefs}`);
  console.log("[db-cutover] Public Article DB reads: PASS");
  console.log("[db-cutover] Public Product DB reads: PASS");
  console.log("[db-cutover] Missing Product references: 0");

  for (const slug of Object.keys(representatives)) {
    const dbArticle = await getArticleBySlug(slug);
    const fsArticle = getResolvedArticleSync(slug);
    assert(Boolean(dbArticle.seoTitle || dbArticle.title), `metaTitle missing: ${slug}`);
    assert(Boolean(dbArticle.description), `metaDescription missing: ${slug}`);
    const dbMeta = buildArticleMetadata(dbArticle);
    const fsMeta = buildArticleMetadata(fsArticle);
    assert(dbMeta.title === fsMeta.title, `SEO title mismatch: ${slug}`);
    assert(dbMeta.description === fsMeta.description, `SEO description mismatch: ${slug}`);
    assert(
      JSON.stringify(dbMeta.alternates) === JSON.stringify(fsMeta.alternates),
      `canonical mismatch: ${slug}`,
    );
    assert(JSON.stringify(dbMeta.robots) === JSON.stringify(fsMeta.robots), `noindex mismatch: ${slug}`);
    assert(
      (dbMeta.openGraph as { title?: string } | undefined)?.title ===
        (fsMeta.openGraph as { title?: string } | undefined)?.title,
      `OG title mismatch: ${slug}`,
    );
    assert(
      (dbMeta.twitter as { title?: string } | undefined)?.title ===
        (fsMeta.twitter as { title?: string } | undefined)?.title,
      `Twitter title mismatch: ${slug}`,
    );
  }
  console.log("[db-cutover] SEO PARITY: PASS");

  const dbFeatured = (await getFeaturedArticles()).map((a) => a.slug).sort();
  const fsFeatured = getFeaturedArticlesSync()
    .map((a) => a.slug)
    .sort();
  assert(JSON.stringify(dbFeatured) === JSON.stringify(fsFeatured), "featured set mismatch");
  console.log("[db-cutover] FEATURED PARITY: PASS");

  function assertRuntimeParity(slug: string, label: string) {
    return Promise.resolve().then(async () => {
      const dbResolved = await getResolvedArticle(slug);
      const fsResolved = getResolvedArticleSync(slug);
      assert(
        JSON.stringify(articleRuntimeKey(dbResolved)) ===
          JSON.stringify(articleRuntimeKey(fsResolved)),
        `${label} parity mismatch: ${slug}`,
      );
      assert(Boolean(dbResolved.contentHtml.trim()), `${slug} markdown body missing`);
      for (const product of dbResolved.resolvedProducts) {
        assert(!product.amazonUrl.includes("tag="), `${product.id} stored URL tagged`);
        const tagged = withAffiliateTag(product.amazonUrl);
        assert(tagged.includes(`tag=${siteConfig.affiliateTag}`), `${product.id} CTA missing tag`);
      }
    });
  }

  await assertRuntimeParity("best-office-chairs-small-spaces-2026", "Best List");
  await assertRuntimeParity("best-standing-desks-small-apartments", "Best List");
  await assertRuntimeParity("best-monitor-setup-small-home-office", "Best List");
  console.log("[db-cutover] BEST LIST PARITY: PASS");

  await assertRuntimeParity("flexispot-compact-standing-desk-review", "Review");
  console.log("[db-cutover] REVIEW PARITY: PASS");

  await assertRuntimeParity("standing-desk-vs-writing-desk", "Comparison");
  await assertRuntimeParity("single-vs-dual-monitor-arm", "Comparison");
  console.log("[db-cutover] COMPARISON PARITY: PASS");

  await assertRuntimeParity("40-inch-desk-setup", "Guide");
  console.log("[db-cutover] GUIDE PARITY: PASS");

  const affiliateProduct = await getProductById("flexispot-compact");
  const dbCommerce = (await getProductV1("flexispot-compact"))?.product.commerce?.amazonUrl;
  assert(Boolean(affiliateProduct?.amazonUrl), "amazonUrl missing after adapter");
  assert(Boolean(dbCommerce), "DB commerce.amazonUrl missing");
  assert(!dbCommerce!.includes("tag="), "Stored DB amazonUrl must remain untagged");
  assert(
    !affiliateProduct!.amazonUrl.includes("tag="),
    "Adapted amazonUrl must remain untagged",
  );
  const tagged = withAffiliateTag(affiliateProduct!.amazonUrl);
  assert(tagged.includes(`tag=${siteConfig.affiliateTag}`), "AffiliateButton tag missing");
  assert(Boolean(siteConfig.affiliateTag), "siteConfig.affiliateTag must exist");
  console.log("[db-cutover] AFFILIATE PARITY: PASS");

  const adminProducts = await listAdminProducts();
  const adminArticles = await listAdminArticles();
  assert(adminProducts.length === 13, "Admin products != 13");
  assert(adminArticles.length === 12, "Admin articles != 12");
  console.log("[db-cutover] Admin DB read: PASS");

  const sampleProduct = await getAdminProduct("flexispot-compact");
  const sampleArticle = await getAdminArticle("flexispot-compact-standing-desk-review");
  assert(Boolean(sampleProduct), "admin sample product missing");
  assert(Boolean(sampleArticle), "admin sample article missing");

  const productSave = await saveAdminProduct(sampleProduct!.product, {
    expectedVersion: sampleProduct!.version,
  });
  assert(productSave.ok, `valid Product save failed: ${productSave.errors.join("; ")}`);

  const articleSave = await saveAdminArticle(sampleArticle!.article, {
    expectedVersion: sampleArticle!.version,
    body: sampleArticle!.body,
  });
  assert(articleSave.ok, `valid Article save failed: ${articleSave.errors.join("; ")}`);
  console.log("[db-cutover] Admin DB write: PASS");

  const staleProduct = await getAdminProduct("flexispot-compact");
  assert(Boolean(staleProduct?.version), "product version missing for concurrency test");
  const staleSave = await saveAdminProduct(staleProduct!.product, {
    expectedVersion: (staleProduct!.version ?? 1) - 1,
  });
  assert(!staleSave.ok, "stale product write must fail");
  assert(
    staleSave.errors.some((error) => error.toLowerCase().includes("stale")),
    `stale write error missing: ${staleSave.errors.join("; ")}`,
  );
  const unchanged = await getAdminProduct("flexispot-compact");
  assert(
    JSON.stringify(unchanged?.product) === JSON.stringify(staleProduct!.product),
    "stale write mutated product data",
  );
  console.log("[db-cutover] OPTIMISTIC CONCURRENCY: PASS");

  const invalidProduct = {
    schemaVersion: 1,
    id: "invalid-test-product",
    identity: { name: "", brand: "X", category: "desks" },
  } as ProductV1Document;
  assert(!validateAdminProductSave(invalidProduct).ok, "INVALID PRODUCT SAVE must fail");

  const invalidArticle = {
    identity: { id: "bad", title: "", slug: "bad" },
    classification: { type: "review" },
    editorial: { intent: "commercial" },
    publishing: { status: "draft" },
  } as ArticleV1;
  assert(!(await validateAdminArticleSave(invalidArticle)).ok, "INVALID ARTICLE SAVE must fail");
  assert(!(await getProductV1("invalid-test-product")), "invalid product must not persist");
  console.log("[db-cutover] INVALID ARTICLE SAVE: PASS");
  console.log("[db-cutover] INVALID PRODUCT SAVE: PASS");

  const publishedComparison = await getAdminArticle("standing-desk-vs-writing-desk");
  assert(Boolean(publishedComparison), "comparison article missing");

  const badMissing = structuredClone(publishedComparison!.article) as ArticleV1;
  if (badMissing.products?.primary?.[0]) {
    badMissing.products.primary[0].productId = "does-not-exist-product";
  }
  assert(!(await validateAdminArticleSave(badMissing)).ok, "missing productId must fail");

  const badDup = structuredClone(publishedComparison!.article) as ArticleV1;
  if (badDup.products?.primary?.[0]) {
    const first = badDup.products.primary[0];
    badDup.products.primary = [first, { ...first }];
  }
  assert(!(await validateAdminArticleSave(badDup)).ok, "duplicate product refs must fail");

  const bestList = await getAdminArticle("best-office-chairs-small-spaces-2026");
  assert(Boolean(bestList), "best-list article missing");
  const badRanks = structuredClone(bestList!.article) as ArticleV1;
  if (badRanks.products?.primary && badRanks.products.primary.length >= 2) {
    badRanks.products.primary[0].rank = 1;
    badRanks.products.primary[1].rank = 1;
  }
  assert(!(await validateAdminArticleSave(badRanks)).ok, "duplicate ranks must fail");

  const badWinner = structuredClone(publishedComparison!.article) as ArticleV1;
  if (badWinner.comparison) {
    badWinner.comparison.winnerId = "not-a-real-winner";
  }
  assert(!(await validateAdminArticleSave(badWinner)).ok, "invalid comparison winner must fail");
  console.log("[db-cutover] Cross-reference validation: PASS");
  console.log(
    "[db-cutover] Auth boundary: unchanged (saveAdmin*Action still calls requireAdmin; store-level DB save tested separately)",
  );

  const originalUrl = process.env.DATABASE_URL;
  process.env.CONTENT_STORE = "database";
  process.env.DATABASE_URL =
    "postgresql://smartdesk:local-development-only@127.0.0.1:1/smartdesk?connect_timeout=2";
  await closeDb();
  assert(
    isDatabaseContentStore(),
    "CONTENT_STORE=database + bad URL must still select database mode",
  );

  let failedClosed = false;
  try {
    await listDatabaseProductIds();
  } catch (error) {
    failedClosed = true;
    console.log(`[db-cutover] DB unavailable clear failure: ${maskError(error)}`);
  }
  assert(failedClosed, "DB unavailable must fail closed (no silent success)");
  console.log("[db-cutover] DB failure mode: fail-closed PASS");

  process.env.DATABASE_URL = originalUrl;
  process.env.CONTENT_STORE = "database";
  await closeDb();
  const restored = await listProductV1Ids();
  assert(restored.length === 13, "restore after fail-closed failed");

  await closeDb();
  console.log("[db-cutover] ALL CHECKS PASS");
}

main().catch((error) => {
  const err = error as { message?: string; cause?: unknown; errors?: unknown[] };
  console.error(maskError(err.message ?? error));
  if (err.cause) console.error("cause:", maskError(err.cause));
  if (Array.isArray((err.cause as { errors?: unknown[] } | undefined)?.errors)) {
    for (const nested of (err.cause as { errors: unknown[] }).errors) {
      console.error("nested:", maskError(nested));
    }
  }
  process.exit(1);
});
