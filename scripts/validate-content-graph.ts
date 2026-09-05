/**
 * Content Commerce Graph validation (Phase 28–30).
 * Run: npm run validate:content-graph
 */
import "./load-env-local";
import fs from "fs";
import path from "path";
import { listArticlesV1, getArticleV1 } from "../src/lib/content/articles";
import { listProductsV1 } from "../src/lib/content/products";
import { listFilesystemProductsV1 } from "../src/lib/content/filesystem-products";
import {
  buildContentGraph as buildEditorialGraph,
  getGraphOverview,
  findInternalLinkOpportunities,
} from "../src/lib/editorial/content-graph";
import {
  buildContentGraph,
  buildContentGraphReport,
  buildInternalLinkSuggestions,
  buildTopicClusters,
  findArticlesForProduct,
  findUnreferencedProducts,
  getTopicArticles,
  getTopicProducts,
  resolveArticleContentGraph,
  resolveContentGraphViewModel,
  validateContentGraphIntegrity,
} from "../src/lib/content-graph";
import { validateArticleV1 } from "../src/lib/article-schema";
import { closeDb } from "../src/lib/db/client";
import type { ArticleV1 } from "../src/types/article-v1";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) passed++;
  else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

function readFixtureBundle(fileName: string): {
  articles: ArticleV1[];
  expected: { topicId: string; productId: string; minArticlesForProduct: number };
} {
  const filePath = path.join(process.cwd(), "content/examples", fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as {
    articles: ArticleV1[];
    expected: { topicId: string; productId: string; minArticlesForProduct: number };
  };
}

async function main() {
  const products = await listProductsV1();
  const articles = await listArticlesV1();
  const fsProducts = listFilesystemProductsV1();

  console.log("=== Content Graph integrity ===");
  const integrity = validateContentGraphIntegrity(articles, products);
  for (const w of integrity.warnings) console.warn(`WARN: ${w.message}`);
  for (const e of integrity.errors) console.error(`ERROR: ${e.message}`);
  assert(integrity.valid, "production corpus relationship integrity");

  const graph = buildContentGraph(articles, products);
  assert(graph.articleIds.length === articles.length, "graph indexes all articles");
  assert(graph.productIds.length === products.length, "graph indexes all products");
  assert(graph.topics.size > 0, "topic clusters exist");

  const unreferenced = findUnreferencedProducts(articles, products);
  console.log(`Unreferenced products (gap signal): ${unreferenced.length}`);

  console.log("\n=== Phase 30 ViewModel / suggestions / SEO signals ===");
  const sample =
    articles.find((a) => a.identity.slug === "best-office-chairs-small-spaces-2026") ??
    articles.find((a) => a.publishing.status === "published");
  assert(Boolean(sample), "sample published article exists");
  if (sample) {
    const vm = resolveContentGraphViewModel(sample, articles, products);
    assert(vm.articleId === sample.identity.id, "view model articleId");
    assert(Array.isArray(vm.products), "view model products");
    assert(Array.isArray(vm.incomingReferences), "incoming references");
    assert(Array.isArray(vm.outgoingReferences), "outgoing references");
    assert(typeof vm.seoSignals.topicDepth === "number", "seo topicDepth");
    assert(
      ["orphan", "connected", "isolated-topic"].includes(vm.seoSignals.orphanStatus),
      "seo orphanStatus enum",
    );
    assert(vm.linkSuggestions.sourceArticle === sample.identity.id, "suggestion source");
    const suggestions = buildInternalLinkSuggestions(sample, articles);
    assert(
      suggestions.suggestedArticles.every((s) => s.articleId && s.reason),
      "suggestions have id + reason",
    );
    if (vm.topic) {
      assert(getTopicArticles(vm.topic.topicId, articles).length >= 1, "topic articles query");
      assert(getTopicProducts(vm.topic.topicId, articles, products).length >= 0, "topic products query");
    }
  }

  const report = buildContentGraphReport(articles, products);
  assert(report.articleCount === articles.length, "report article count");
  assert(report.productCount === products.length, "report product count");

  console.log("\n=== Fixtures ===");
  const chairBundle = readFixtureBundle("content-graph-office-chairs-fixture.json");
  const deskBundle = readFixtureBundle("content-graph-standing-desks-fixture.json");

  for (const [label, bundle] of [
    ["office-chairs", chairBundle],
    ["standing-desks", deskBundle],
  ] as const) {
    for (const article of bundle.articles) {
      assert(validateArticleV1(article).valid, `${label}/${article.identity.id} structural`);
    }
    assert(
      validateContentGraphIntegrity(bundle.articles, fsProducts).valid,
      `${label} fixture integrity`,
    );
    const topics = buildTopicClusters(bundle.articles);
    const topic = topics.get(bundle.expected.topicId);
    assert(Boolean(topic), `${label} topic exists`);
    assert((topic?.articleIds.length ?? 0) >= 2, `${label} topic clustered`);
    assert(
      findArticlesForProduct(bundle.expected.productId, bundle.articles).length >=
        bundle.expected.minArticlesForProduct,
      `${label} product featured`,
    );
    const view = resolveArticleContentGraph(bundle.articles[0]!, bundle.articles, fsProducts);
    assert(view.products.length > 0, `${label} resolver products`);
    assert(view.topic?.topicId === bundle.expected.topicId, `${label} resolver topic`);
    const fixtureVm = resolveContentGraphViewModel(bundle.articles[0]!, bundle.articles, fsProducts);
    assert(fixtureVm.relatedArticles.length >= 1, `${label} view model related`);
  }

  console.log("\n=== Integrity negatives ===");
  assert(
    !validateContentGraphIntegrity(
      [{ ...chairBundle.articles[0]!, relationships: { parentTopic: "office-chairs", relatedArticles: ["does-not-exist-article"] } }],
      fsProducts,
    ).valid,
    "missing relatedArticles id fails",
  );
  assert(
    !validateContentGraphIntegrity(
      [{ ...chairBundle.articles[0]!, products: { primary: [{ productId: "missing-product-xyz", rank: 1 }] } }],
      fsProducts,
    ).valid,
    "missing productId fails",
  );
  assert(
    !validateContentGraphIntegrity(
      [{ ...chairBundle.articles[0]!, relationships: { parentTopic: "office-chairs", relatedArticles: [chairBundle.articles[0]!.identity.id] } }],
      fsProducts,
    ).valid,
    "self relatedArticles fails",
  );

  console.log("\n=== Orphan detection ===");
  const orphanFixture: ArticleV1 = {
    ...chairBundle.articles[0]!,
    identity: { id: "cg-orphan-fixture", slug: "cg-orphan-fixture", title: "Orphan Fixture" },
    products: { primary: [] },
    relationships: { parentTopic: "orphan-topic-only" },
    publishing: { ...chairBundle.articles[0]!.publishing, status: "published" },
  };
  const orphanReport = buildContentGraphReport([orphanFixture], fsProducts);
  assert(orphanReport.orphanArticles.some((a) => a.articleId === "cg-orphan-fixture"), "orphan detected");
  assert(orphanReport.articlesWithoutProducts.some((a) => a.articleId === "cg-orphan-fixture"), "no-products detected");

  console.log("\n=== Editorial link overview ===");
  const bodies = new Map<string, string>();
  for (const a of articles) {
    bodies.set(a.identity.id, (await getArticleV1(a.identity.id))?.body ?? "");
  }
  const editorialGraph = buildEditorialGraph(articles, bodies, products);
  const overview = getGraphOverview(editorialGraph);
  console.log(`Published articles: ${overview.publishedCount}`);
  console.log(`Broken internal links: ${overview.brokenLinks.length}`);
  let totalOpps = 0;
  for (const a of articles.filter((x) => x.publishing.status === "published")) {
    totalOpps += findInternalLinkOpportunities(a.identity.id, editorialGraph).length;
  }
  console.log(`Total article-level opportunities: ${totalOpps}`);
  if (overview.brokenLinks.length > 0) {
    failed++;
    console.error("FAIL: broken internal links");
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0 || !integrity.valid) process.exit(1);
  console.log("Content graph validation passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb().catch(() => undefined);
  });
