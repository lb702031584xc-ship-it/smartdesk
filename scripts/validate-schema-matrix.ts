/**
 * Phase 5 schema migration matrix checks.
 *
 * Run: npm run validate:schema-matrix
 */
import {
  roleToLegacyBadge,
} from "../src/lib/article-schema";
import {
  clearArticleCache,
  getArticleMetaSync,
  getResolvedArticleSync,
} from "../src/lib/articles";
import { clearProductCache, getProductByIdSync } from "../src/lib/products";
import { isProductV1Document } from "../src/lib/product-schema";
import fs from "fs";
import path from "path";

function fail(message: string): never {
  console.error(`[schema-matrix] ${message}`);
  process.exit(1);
}

function pass(label: string, detail?: string) {
  console.log(`[schema-matrix] PASS ${label}${detail ? ` ??${detail}` : ""}`);
}

clearProductCache();
clearArticleCache();

// CASE A ??Best List V1 + legacy products
{
  const article = getResolvedArticleSync("best-monitor-setup-small-home-office");
  if (article.type !== "best") fail("CASE A: expected best type");
  if (!article.winnerId) fail("CASE A: missing winnerId");
  const dual = article.resolvedProducts.find((p) => p.id === "monitor-arm-dual");
  const light = article.resolvedProducts.find((p) => p.id === "monitor-light-bar");
  if (!dual || !light) fail("CASE A: products failed to resolve");
  if (article.winnerId !== "monitor-arm-dual") {
    fail(`CASE A: winnerId expected monitor-arm-dual, got ${article.winnerId}`);
  }
  pass("CASE A", "Best List V1 ??all Product V1 catalog");
}

// CASE B ??Article V1 ??Product V1
{
  const product = getProductByIdSync("single-monitor-arm");
  if (!product) fail("CASE B: Product V1 did not resolve via getProductByIdSync");
  const best = getResolvedArticleSync("best-monitor-setup-small-home-office");
  const arm = best.resolvedProducts.find((p) => p.id === "single-monitor-arm");
  if (!arm) fail("CASE B: Product V1 missing from Best List resolution");
  const raw = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "content/products/single-monitor-arm.json"),
      "utf8",
    ),
  );
  if (!isProductV1Document(raw)) fail("CASE B: single-monitor-arm is not Product V1");
  pass("CASE B", "Article V1 ??Product V1 resolve");
}

// CASE C ??Review V1
{
  const article = getResolvedArticleSync("single-monitor-arm-review");
  if (article.type !== "review") fail("CASE C: expected review type");
  if (article.productId !== "single-monitor-arm") {
    fail(`CASE C: productId expected single-monitor-arm, got ${article.productId}`);
  }
  if (!article.resolvedProduct || article.resolvedProduct.id !== "single-monitor-arm") {
    fail("CASE C: resolvedProduct missing");
  }
  if (!article.resolvedProduct.amazonUrl) fail("CASE C: amazonUrl missing after adapt");
  if (!article.resolvedProduct.pros?.length || !article.resolvedProduct.cons?.length) {
    fail("CASE C: pros/cons missing");
  }
  pass("CASE C", "Review V1 ??product resolve");
}

// CASE D ??Comparison V1 (two products + winner)
{
  const article = getResolvedArticleSync("single-vs-dual-monitor-arm");
  if (article.type !== "comparison") fail("CASE D: expected comparison type");
  if (article.resolvedProducts.length < 2) fail("CASE D: need two products");
  if (article.winnerId !== "monitor-arm-dual") {
    fail(`CASE D: winnerId expected monitor-arm-dual, got ${article.winnerId}`);
  }
  if (!article.winnerReason) fail("CASE D: winnerReason missing");
  const order = article.productRefs.map((ref) => ref.id);
  if (order[0] !== "monitor-arm-dual" || order[1] !== "single-monitor-arm") {
    fail(`CASE D: unstable product order: ${order.join(", ")}`);
  }
  pass("CASE D", "Comparison V1 ??winner resolve");
}

// CASE E ??Mixed legacy + Product V1 in one comparison
{
  const article = getResolvedArticleSync("standing-desk-vs-writing-desk");
  const v1Raw = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "content/products/flexispot-compact.json"),
      "utf8",
    ),
  );
  const legacyRaw = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "content/products/bamboo-writing-desk.json"),
      "utf8",
    ),
  );
  if (!isProductV1Document(v1Raw)) fail("CASE E: flexispot-compact should be Product V1");
  if (!isProductV1Document(legacyRaw)) {
    fail("CASE E: bamboo-writing-desk should be Product V1 after final migration");
  }
  const v1 = article.resolvedProducts.find((p) => p.id === "flexispot-compact");
  const bamboo = article.resolvedProducts.find((p) => p.id === "bamboo-writing-desk");
  if (!v1 || !bamboo) fail("CASE E: V1+V1 resolve failed");
  if (article.winnerId !== "flexispot-compact") fail("CASE E: winner changed");
  pass("CASE E", "Product V1 + Product V1 in one Article V1 comparison");
}

// CASE F ??Production catalog fully Product V1; legacy loader branch retained
{
  let legacyFiles = 0;
  const productsDir = path.join(process.cwd(), "content/products");
  for (const fileName of fs.readdirSync(productsDir).filter((f) => f.endsWith(".json"))) {
    const parsed = JSON.parse(
      fs.readFileSync(path.join(productsDir, fileName), "utf8"),
    );
    if (!isProductV1Document(parsed)) legacyFiles += 1;
  }
  if (legacyFiles !== 0) {
    fail(`CASE F: expected 0 legacy product files, found ${legacyFiles}`);
  }
  const product = getProductByIdSync("bamboo-writing-desk");
  if (!product) fail("CASE F: V1 product resolve failed");
  pass("CASE F", "production catalog all Product V1; V1-only loader");
}

// Article role vs product role (must be allowed to differ)
{
  const productPath = path.join(
    process.cwd(),
    "content/products/single-monitor-arm.json",
  );
  const product = JSON.parse(fs.readFileSync(productPath, "utf8")) as {
    editorial?: { role?: string };
  };
  const bestData = JSON.parse(
    fs.readFileSync(
      path.join(
        process.cwd(),
        "content/article-data/best-monitor-setup-small-home-office.json",
      ),
      "utf8",
    ),
  ) as {
    products: { primary: Array<{ productId: string; role?: string }> };
  };
  const articleRole = bestData.products.primary.find(
    (ref) => ref.productId === "single-monitor-arm",
  )?.role;
  const productRole = product.editorial?.role;
  if (!articleRole || !productRole) fail("role check: missing roles");
  if (articleRole === productRole) {
    fail(
      `role check: expected article role (${articleRole}) to differ from product role (${productRole})`,
    );
  }
  const meta = getArticleMetaSync("best-monitor-setup-small-home-office");
  const badge = meta?.productRefs.find((ref) => ref.id === "single-monitor-arm")?.badge;
  if (badge !== roleToLegacyBadge(articleRole)) {
    fail("role check: article role did not map to badge");
  }
  pass(
    "role separation",
    `product=${productRole}, article=${articleRole} ??badge=${badge}`,
  );
}

// Affiliate contract smoke check
{
  const product = getProductByIdSync("single-monitor-arm");
  if (!product?.amazonUrl?.includes("amazon.com")) {
    fail("affiliate: adapted amazonUrl missing");
  }
  pass("affiliate", "Product V1 commerce.amazonUrl ??legacy Product.amazonUrl");
}

console.log("[schema-matrix] all cases passed");


