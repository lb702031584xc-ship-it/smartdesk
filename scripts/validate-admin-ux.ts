/**
 * Lightweight Admin UX checks for search, filters, change summary, and signals.
 */
import {
  DEFAULT_ARTICLE_FILTERS,
  DEFAULT_PRODUCT_FILTERS,
  filterAdminArticles,
  filterAdminProducts,
} from "../src/lib/admin/list-filters";
import {
  articleChangeSummary,
  highRiskArticleChanges,
  highRiskProductChanges,
  productChangeSummary,
} from "../src/lib/admin/change-summary";
import { PRODUCT_CATEGORIES } from "../src/lib/admin/editor-constants";
import { isAmazonSearchUrl } from "../src/lib/admin/editorial-signals";
import { articleLocalHints, productLocalHints } from "../src/lib/admin/local-hints";
import { classifySaveFailure, saveRefreshStatusDetail } from "../src/lib/admin/save-feedback";
import { listAdminArticles, listAdminProducts } from "../src/lib/admin";
import { closeDb } from "../src/lib/db/client";
import type { ArticleListItem, ProductListItem } from "../src/lib/admin/types";
import type { ArticleV1 } from "../src/types/article-v1";
import type { ProductV1Document } from "../src/types/product-v1";

function fail(message: string): never {
  console.error(`[admin-ux] ${message}`);
  process.exit(1);
}

function assert(condition: boolean, message: string) {
  if (!condition) fail(message);
}

async function main() {
  const products = await listAdminProducts();
  const articles = await listAdminArticles();
  assert(products.length === 13, `expected 13 products, got ${products.length}`);
  assert(articles.length === 12, `expected 12 articles, got ${articles.length}`);

  const chairHits = filterAdminProducts(products, {
    ...DEFAULT_PRODUCT_FILTERS,
    query: "chair",
  });
  assert(chairHits.length > 0 && chairHits.length < products.length, "product search should narrow results");

  const deskFilter = filterAdminProducts(products, {
    ...DEFAULT_PRODUCT_FILTERS,
    category: "desks",
  });
  assert(
    deskFilter.every((product) => product.category === "desks") && deskFilter.length > 0,
    "category filter should keep only desks",
  );
  assert(deskFilter.length < products.length, "category filter should reduce the set");

  const cleared = filterAdminProducts(products, DEFAULT_PRODUCT_FILTERS);
  assert(cleared.length === products.length, "clear filters should restore full product list");

  const reviewHits = filterAdminArticles(articles, {
    ...DEFAULT_ARTICLE_FILTERS,
    type: "review",
  });
  assert(
    reviewHits.length > 0 &&
      reviewHits.length < articles.length &&
      reviewHits.every((article) => article.type === "review"),
    "article type filter should keep reviews only",
  );

  const titleHits = filterAdminArticles(articles, {
    ...DEFAULT_ARTICLE_FILTERS,
    query: "standing",
  });
  assert(titleHits.length > 0 && titleHits.length < articles.length, "article search should narrow results");

  const restoredArticles = filterAdminArticles(articles, DEFAULT_ARTICLE_FILTERS);
  assert(restoredArticles.length === articles.length, "clear filters should restore full article list");

  assert(
    PRODUCT_CATEGORIES.join(",") === "desks,chairs,monitors,accessories",
    "product filters must use canonical categories only",
  );

  const beforeProduct = {
    identity: { name: "A", brand: "B", category: "desks" },
    editorial: { verdict: "old", featured: false },
    commerce: { amazonUrl: "https://www.amazon.com/dp/ABC", asin: "ABC" },
    review: { rating: 4 },
  };
  const afterProduct = {
    ...beforeProduct,
    editorial: { verdict: "new", featured: true, bestFor: ["small rooms"] },
    commerce: { amazonUrl: "https://www.amazon.com/s?k=desk", asin: "ABC" },
    review: { rating: 4.5 },
  };
  const productLines = productChangeSummary(
    beforeProduct as Record<string, unknown>,
    afterProduct as Record<string, unknown>,
  );
  assert(
    productLines.some((line) => line.section === "Editorial" && line.detail.includes("verdict")),
    "change summary should include verdict",
  );
  const productRisk = highRiskProductChanges(
    beforeProduct as Record<string, unknown>,
    afterProduct as Record<string, unknown>,
  );
  assert(productRisk.includes("commerce.amazonUrl"), "amazonUrl change is high-risk");
  assert(productRisk.includes("featured"), "featured change is high-risk");
  assert(productRisk.includes("rating"), "rating change is high-risk");

  const beforeArticle = {
    publishing: { status: "draft", featured: false },
    comparison: { winnerId: "a" },
    products: { primary: [{ productId: "a", rank: 1 }] },
    seo: { noindex: false, canonical: "/blog/a" },
    faq: [{ question: "Q1", answer: "A1" }],
  };
  const afterArticle = {
    publishing: { status: "published", featured: true },
    comparison: { winnerId: "b" },
    products: { primary: [{ productId: "a", rank: 2 }, { productId: "b", rank: 1 }] },
    seo: { noindex: true, canonical: "/blog/b" },
    faq: [
      { question: "Q1", answer: "A1" },
      { question: "Q2", answer: "A2" },
    ],
  };
  const articleLines = articleChangeSummary(
    beforeArticle as Record<string, unknown>,
    afterArticle as Record<string, unknown>,
  );
  assert(
    articleLines.some((line) => line.section === "FAQ" && line.detail.includes("added")),
    "FAQ addition should appear in change summary",
  );
  assert(
    articleLines.some((line) => line.detail.includes("rank changed for a")),
    "rank change should appear in change summary",
  );
  const articleRisk = highRiskArticleChanges(
    beforeArticle as Record<string, unknown>,
    afterArticle as Record<string, unknown>,
  );
  assert(articleRisk.includes("publishing.status"), "status change is high-risk");
  assert(articleRisk.includes("comparison.winnerId"), "winner change is high-risk");

  const { articleBodyChangeLine } = await import("../src/lib/admin/article-body");
  const bodyChange = articleBodyChangeLine("hello", "hello world extra");
  assert(Boolean(bodyChange && bodyChange.section === "Article Body"), "body change summary line");
  assert(bodyChange!.detail.includes("+"), "body word delta should appear when easy");

  const emptyPublished = articleLocalHints(
    {
      identity: { id: "a", title: "A", slug: "a" },
      classification: { type: "guide" },
      editorial: { intent: "informational" },
      publishing: { status: "published" },
    } as ArticleV1,
    { mode: "edit", body: "" },
  );
  assert(
    emptyPublished.errors.some((error) => error.includes("Markdown body")),
    "published empty body should error",
  );

  assert(
    saveRefreshStatusDetail({ ok: true, revalidated: true, warnings: [] }, "saved") ===
      "Published page refreshed",
    "refresh success detail",
  );
  assert(
    Boolean(
      saveRefreshStatusDetail(
        { ok: true, warnings: ["Saved, but public page refresh failed."] },
        "saved",
      )?.includes("refresh failed"),
    ),
    "refresh failure detail",
  );

  assert(isAmazonSearchUrl("https://www.amazon.com/s?k=monitor+arm"), "search URL detector");
  assert(!isAmazonSearchUrl("https://www.amazon.com/dp/B0EXAMPLE"), "detail URL is not a search URL");

  const productHint = productLocalHints({
    schemaVersion: 1,
    id: "demo",
    identity: { name: "Demo", brand: "X", category: "desks" },
    commerce: { amazonUrl: "https://www.amazon.com/s?k=desk" },
    review: { rating: 9 },
  } as ProductV1Document);
  assert(productHint.errors.some((error) => error.includes("rating")), "rating out of range should error");
  assert(productHint.warnings.some((warning) => warning.includes("search URL")), "search URL warning should render");

  const articleHint = articleLocalHints({
    identity: { id: "a", title: "A", slug: "a" },
    classification: { type: "comparison" },
    editorial: { intent: "commercial" },
    publishing: { status: "draft" },
    products: { primary: [{ productId: "one", rank: 1 }, { productId: "two", rank: 1 }] },
    comparison: { winnerId: "missing" },
    faq: [{ question: "", answer: "Need a question" }],
  } as ArticleV1);
  assert(articleHint.errors.some((error) => error.includes("Duplicate product rank")), "duplicate rank error");
  assert(articleHint.errors.some((error) => error.includes("winner")), "invalid winner error");
  assert(articleHint.errors.some((error) => error.includes("FAQ")), "empty FAQ question error");

  assert(
    classifySaveFailure(["This record changed after you opened it. Reload before saving."]).kind === "conflict",
    "concurrency errors should classify as conflict",
  );
  assert(
    classifySaveFailure(["Your admin session has expired. Sign in again before saving."]).kind === "session",
    "session errors should classify as session",
  );
  assert(
    classifySaveFailure(["Duplicate product rank: 1."]).kind === "validation",
    "local errors should classify as validation",
  );
  assert(classifySaveFailure(["Database save failed."]).kind === "database", "database errors should classify as database");

  const sample: ProductListItem = products[0];
  const sampleArticle: ArticleListItem = articles[0];
  assert(Boolean(sample.id && sampleArticle.id), "list items should include ids");

  await closeDb();
  console.log("[admin-ux] Product search/filters: PASS");
  console.log("[admin-ux] Article search/filters: PASS");
  console.log("[admin-ux] Change summary: PASS");
  console.log("[admin-ux] High-risk detection: PASS");
  console.log("[admin-ux] Validation/concurrency signals: PASS");
}

main().catch(async (error) => {
  console.error(error);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
