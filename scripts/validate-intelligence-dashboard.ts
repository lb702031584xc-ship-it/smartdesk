/**
 * Intelligence Dashboard UI validation (Phase 33).
 * Usage: npm run validate:intelligence-dashboard
 *
 * Confirms routes/components exist and read models render via presentation components.
 * No mutations. No CMS.
 */
import "./load-env-local";
import fs from "fs";
import path from "path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildContentOverviewViewModel,
  buildProductCoverageViewModels,
  buildTopicHealthViewModels,
  getContentOverviewViewModel,
} from "../src/lib/content-dashboard";
import { listArticlesV1 } from "../src/lib/content/articles";
import { listProductsV1 } from "../src/lib/content/products";
import { validateContentGraphIntegrity } from "../src/lib/content-graph";
import { closeDb } from "../src/lib/db/client";
import { ContentOverviewCard } from "../src/components/intelligence/ContentOverviewCard";
import { CoverageStatusCard } from "../src/components/intelligence/CoverageStatusCard";
import { CommerceSignalsCard } from "../src/components/intelligence/CommerceSignalsCard";
import { TopicHealthTable } from "../src/components/intelligence/TopicHealthTable";
import { ProductCoverageTable } from "../src/components/intelligence/ProductCoverageTable";
import { IntelligenceEmptyState } from "../src/components/intelligence/SignalBadge";

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
  const full = path.join(process.cwd(), rel);
  assert(fs.existsSync(full), `exists ${rel}`);
}

async function main() {
  console.log("=== Route / component files ===");
  assertFile("src/app/dashboard/layout.tsx");
  assertFile("src/app/dashboard/intelligence/page.tsx");
  assertFile("src/app/dashboard/intelligence/topics/page.tsx");
  assertFile("src/app/dashboard/intelligence/products/page.tsx");
  assertFile("src/components/intelligence/ContentOverviewCard.tsx");
  assertFile("src/components/intelligence/CoverageStatusCard.tsx");
  assertFile("src/components/intelligence/CommerceSignalsCard.tsx");
  assertFile("src/components/intelligence/TopicHealthTable.tsx");
  assertFile("src/components/intelligence/ProductCoverageTable.tsx");
  assertFile("src/components/intelligence/SignalBadge.tsx");
  assertFile("src/components/intelligence/IntelligenceShell.tsx");
  assertFile("src/app/dashboard/editorial/page.tsx");
  assertFile("src/app/dashboard/intelligence/ai/page.tsx");
  assertFile("src/components/editorial/EditorialWorkspaceShell.tsx");

  console.log("=== Services resolve ===");
  const articles = await listArticlesV1();
  const products = await listProductsV1();
  const integrity = validateContentGraphIntegrity(articles, products);
  assert(integrity.valid, "graph integrity for dashboard data");

  const overview = buildContentOverviewViewModel(articles, products);
  const topics = buildTopicHealthViewModels(articles, products);
  const productCoverage = buildProductCoverageViewModels(articles, products);
  const asyncOverview = await getContentOverviewViewModel();
  assert(asyncOverview.totalArticles === overview.totalArticles, "async overview");

  console.log("=== Overview rendering ===");
  const overviewHtml = renderToStaticMarkup(
    React.createElement(ContentOverviewCard, { overview }),
  );
  assert(overviewHtml.includes("Content Overview"), "overview card title");
  assert(overviewHtml.includes(String(overview.totalArticles)), "overview articles count");

  const coverageHtml = renderToStaticMarkup(
    React.createElement(CoverageStatusCard, { overview }),
  );
  assert(coverageHtml.includes("Coverage Health"), "coverage card title");
  assert(coverageHtml.includes("Orphan articles"), "orphan label");

  const commerceHtml = renderToStaticMarkup(
    React.createElement(CommerceSignalsCard, { overview }),
  );
  assert(commerceHtml.includes("Commerce Signals"), "commerce card title");
  assert(commerceHtml.includes("productWithoutArticle") || commerceHtml.includes("Product without article"), "commerce signal row");

  console.log("=== Topic list rendering ===");
  const topicsHtml = renderToStaticMarkup(
    React.createElement(TopicHealthTable, { topics }),
  );
  assert(topicsHtml.includes("Topic Health"), "topic table title");
  if (topics.length > 0) {
    assert(topicsHtml.includes(topics[0]!.topic), "first topic id rendered");
  } else {
    assert(topicsHtml.includes("No topics"), "empty topics message");
  }

  console.log("=== Product coverage rendering ===");
  const productsHtml = renderToStaticMarkup(
    React.createElement(ProductCoverageTable, { products: productCoverage }),
  );
  assert(productsHtml.includes("Product Coverage"), "product table title");
  if (productCoverage.length > 0) {
    assert(productsHtml.includes(productCoverage[0]!.productId), "first product id");
  }

  console.log("=== Empty states ===");
  const emptyTopics = renderToStaticMarkup(
    React.createElement(TopicHealthTable, { topics: [] }),
  );
  assert(emptyTopics.includes("No topics found"), "empty topics state");
  const emptyProducts = renderToStaticMarkup(
    React.createElement(ProductCoverageTable, { products: [] }),
  );
  assert(emptyProducts.includes("No products found"), "empty products state");
  const emptyGeneric = renderToStaticMarkup(
    React.createElement(IntelligenceEmptyState, { message: "Nothing here" }),
  );
  assert(emptyGeneric.includes("Nothing here"), "generic empty state");

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("Intelligence dashboard validation passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb().catch(() => undefined);
  });
