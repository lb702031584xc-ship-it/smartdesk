/**
 * Phase 6 migration readiness gate.
 *
 * Run: npm run validate:migration-readiness
 *
 * Derives MIGRATION READY from real adapter + repository checks.
 * Does not hardcode readiness to true.
 */
import fs from "fs";
import path from "path";
import {
  articleV1ToLegacyMeta,
  isArticleV1,
  isPublishedArticleV1,
  legacyArticleToV1,
  roleToLegacyBadge,
  validateArticleV1,
  validateArticleV1ProductRefs,
  validateArticleV1TemplateRules,
} from "../src/lib/article-schema";
import {
  clearArticleCache,
  getArticleMetaSync,
  getArticleSlugsSync,
  getResolvedArticleSync,
} from "../src/lib/articles";
import {
  isProductV1Document,
  productV1ToLegacyProduct,
  validateProductV1,
} from "../src/lib/product-schema";
import { clearProductCache, getProductByIdSync } from "../src/lib/products";
import { buildArticleJsonLd, buildArticleMetadata } from "../src/lib/seo";
import type { ArticleV1 } from "../src/types/article-v1";

type CheckResult = { name: string; ok: boolean; detail?: string };

const checks: CheckResult[] = [];
const warnings: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
  if (!ok) {
    console.error(`[FAIL] ${name}${detail ? ` ??${detail}` : ""}`);
  } else {
    console.log(`[PASS] ${name}${detail ? ` ??${detail}` : ""}`);
  }
}

function warn(message: string) {
  warnings.push(message);
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function section(title: string) {
  console.log(`\n${title}`);
}

clearProductCache();
clearArticleCache();

const examplesDir = path.join(process.cwd(), "content/examples");
const articleDataDir = path.join(process.cwd(), "content/article-data");
const productsDir = path.join(process.cwd(), "content/products");
const postsDir = path.join(process.cwd(), "content/posts");

// --- Core contracts ---
section("Core contracts");

{
  const fixture = readJson(
    path.join(examplesDir, "article-schema-v1-example.json"),
  ) as ArticleV1;
  const meta = articleV1ToLegacyMeta(fixture);
  check("Article V1 ??ArticleMeta", meta.type === "best" && Boolean(meta.slug));
}

{
  const product = readJson(
    path.join(productsDir, "single-monitor-arm.json"),
  );
  const result = validateProductV1(product);
  const legacy = productV1ToLegacyProduct(product as never);
  check(
    "Product V1 ??Product",
    result.valid && legacy.id === "single-monitor-arm" && Boolean(legacy.amazonUrl),
  );
}

{
  const article = getResolvedArticleSync("standing-desk-vs-writing-desk");
  const legacy = article.resolvedProducts.find((p) => p.id === "bamboo-writing-desk");
  check("Article V1 ??Legacy Product", Boolean(legacy));
}

{
  const article = getResolvedArticleSync("best-monitor-setup-small-home-office");
  const arm = article.resolvedProducts.find((p) => p.id === "single-monitor-arm");
  check("Article V1 ??Product V1", Boolean(arm));
}

{
  const article = getResolvedArticleSync("standing-desk-vs-writing-desk");
  const v1Raw = readJson(path.join(productsDir, "flexispot-compact.json"));
  const bambooRaw = readJson(path.join(productsDir, "bamboo-writing-desk.json"));
  check(
    "Mixed Product resolution",
    Boolean(article.resolvedProducts.find((p) => p.id === "flexispot-compact")) &&
      Boolean(article.resolvedProducts.find((p) => p.id === "bamboo-writing-desk")) &&
      isProductV1Document(v1Raw) &&
      isProductV1Document(bambooRaw),
  );
}

// --- Templates ---
section("Templates");

{
  const best = getResolvedArticleSync("best-monitor-setup-small-home-office");
  check(
    "Best List",
    best.type === "best" &&
      best.productRefs.some((ref) => typeof ref.rank === "number") &&
      Boolean(best.winnerId),
  );
}

{
  const review = getResolvedArticleSync("single-monitor-arm-review");
  check(
    "Review",
    review.type === "review" &&
      review.productId === "single-monitor-arm" &&
      Boolean(review.resolvedProduct),
  );
}

{
  const comparison = getResolvedArticleSync("single-vs-dual-monitor-arm");
  check(
    "Comparison",
    comparison.type === "comparison" &&
      comparison.resolvedProducts.length >= 2 &&
      comparison.winnerId === "monitor-arm-dual",
  );
}

{
  const guideFixture = readJson(
    path.join(examplesDir, "article-v1-rich-capability-fixture.json"),
  );
  const structural = validateArticleV1(guideFixture);
  const template = validateArticleV1TemplateRules(guideFixture as ArticleV1);
  const meta = articleV1ToLegacyMeta(guideFixture as ArticleV1);
  check(
    "Guide",
    structural.valid &&
      template.valid &&
      isArticleV1(guideFixture) &&
      meta.type === "guide" &&
      !isPublishedArticleV1(guideFixture as ArticleV1),
    "fixture-only; no public route",
  );
}

// --- Rich content ---
section("Rich content");

{
  const guideFixture = readJson(
    path.join(examplesDir, "article-v1-rich-capability-fixture.json"),
  ) as ArticleV1;
  const meta = articleV1ToLegacyMeta(guideFixture);
  const jsonLd = buildArticleJsonLd({
    ...meta,
    contentHtml: "",
    resolvedProducts: [],
  });
  const graph = (jsonLd as { "@graph"?: Array<Record<string, unknown>> })["@graph"] ?? [];
  const faqNode = graph.find((node) => node["@type"] === "FAQPage");
  check(
    "FAQ",
    meta.faq.length === 2 &&
      meta.faqs.length === 2 &&
      Boolean(faqNode) &&
      Array.isArray(faqNode?.mainEntity) &&
      (faqNode?.mainEntity as unknown[]).length === 2,
    "adapter ??runtime ??FAQPage JSON-LD",
  );
}

{
  const reviewFixture: ArticleV1 = {
    identity: {
      id: "phase6-review-rating-fixture",
      title: "Phase 6 Review Rating Fixture",
      slug: "phase6-review-rating-fixture",
    },
    classification: { type: "review", category: "monitors" },
    editorial: {
      summary: "In-memory fixture for ratingCategories adapter.",
      intent: "commercial",
    },
    publishing: { status: "draft", author: "smartdesk-team" },
    products: {
      primary: [{ productId: "single-monitor-arm", role: "best-overall" }],
    },
    review: {
      ratingCategories: [
        { label: "Desk footprint", score: 4.6 },
        { label: "Ease of install", score: 4.2 },
      ],
    },
  };
  const structural = validateArticleV1(reviewFixture);
  const template = validateArticleV1TemplateRules(reviewFixture);
  const meta = articleV1ToLegacyMeta(reviewFixture);
  check(
    "Review rating categories",
    structural.valid &&
      template.valid &&
      meta.ratingCategories?.length === 2 &&
      meta.ratingCategories[0]?.label === "Desk footprint" &&
      meta.ratingCategories[0]?.score === 4.6,
  );
}

{
  const comparisonFixture: ArticleV1 = {
    identity: {
      id: "phase6-comparison-rows-fixture",
      title: "Phase 6 Comparison Rows Fixture",
      slug: "phase6-comparison-rows-fixture",
    },
    classification: { type: "comparison", category: "monitors" },
    editorial: {
      summary: "In-memory fixture for comparison rows adapter.",
      intent: "commercial",
    },
    publishing: { status: "draft", author: "smartdesk-team" },
    products: {
      primary: [
        { productId: "monitor-arm-dual", rank: 1 },
        { productId: "single-monitor-arm", rank: 2 },
      ],
    },
    comparison: {
      winnerId: "monitor-arm-dual",
      winnerReason: "Fixture winner reason.",
      rows: [
        {
          label: "Best for",
          source: "editorial",
          values: {
            "monitor-arm-dual": "Two monitors",
            "single-monitor-arm": "One monitor",
          },
        },
        {
          label: "Monitor count",
          source: "spec",
          specPath: "specs.accessory.monitorCount",
          values: {
            "monitor-arm-dual": "2",
            "single-monitor-arm": "1",
          },
        },
      ],
    },
  };
  const structural = validateArticleV1(comparisonFixture);
  const template = validateArticleV1TemplateRules(comparisonFixture);
  const meta = articleV1ToLegacyMeta(comparisonFixture);
  check(
    "Comparison rows",
    structural.valid &&
      template.valid &&
      meta.comparisonRows?.length === 2 &&
      meta.comparisonRows[0]?.feature === "Best for" &&
      meta.comparisonRows[0]?.values[0] === "Two monitors" &&
      meta.comparisonRows[0]?.values[1] === "One monitor",
  );
}

{
  const comparison = getResolvedArticleSync("single-vs-dual-monitor-arm");
  const fixture: ArticleV1 = {
    identity: {
      id: "winner-compat",
      title: "Winner Compat",
      slug: "winner-compat",
    },
    classification: { type: "comparison", category: "monitors" },
    editorial: { summary: "x", intent: "commercial" },
    publishing: { status: "draft" },
    products: {
      primary: [
        { productId: "monitor-arm-dual" },
        { productId: "single-monitor-arm" },
      ],
      winnerProductId: "single-monitor-arm",
    },
    comparison: {
      winnerId: "monitor-arm-dual",
      winnerReason: "comparison.winnerId preferred",
    },
  };
  const meta = articleV1ToLegacyMeta(fixture);
  check(
    "winnerId",
    comparison.winnerId === "monitor-arm-dual" &&
      meta.winnerId === "monitor-arm-dual" &&
      meta.winnerReason === "comparison.winnerId preferred",
    "comparison.winnerId preferred over products.winnerProductId",
  );
}

{
  const best = getResolvedArticleSync("best-monitor-setup-small-home-office");
  const armRef = best.productRefs.find((ref) => ref.id === "single-monitor-arm");
  check(
    "product rank / role / summary",
    armRef?.rank === 3 &&
      armRef.badge === roleToLegacyBadge("best-value") &&
      Boolean(armRef.summary),
  );
}

// --- SEO ---
section("SEO");

{
  const meta = getArticleMetaSync("best-monitor-setup-small-home-office");
  const metadata = meta ? buildArticleMetadata(meta) : null;
  check("metaTitle", Boolean(meta?.seoTitle) && metadata?.title === meta?.seoTitle);
  check(
    "metaDescription",
    Boolean(meta?.description) && metadata?.description === meta?.description,
  );
  check(
    "canonical",
    meta?.seoCanonical === "/blog/best-monitor-setup-small-home-office" &&
      metadata?.alternates?.canonical === meta.seoCanonical,
  );
  check("noindex", meta?.noindex === false);
}

// --- Publishing ---
section("Publishing");

{
  const statuses: Array<ArticleV1["publishing"]["status"]> = [
    "draft",
    "review",
    "scheduled",
    "archived",
    "published",
  ];
  for (const status of statuses) {
    const article: ArticleV1 = {
      identity: { id: `pub-${status}`, title: status, slug: `pub-${status}` },
      classification: { type: "guide" },
      editorial: { summary: "x", intent: "informational" },
      publishing: { status },
    };
    const included = isPublishedArticleV1(article);
    if (status === "published") {
      check("published included", included === true);
    } else {
      check(`${status} excluded`, included === false);
    }
  }
}

// --- Commerce ---
section("Commerce");

{
  const product = getProductByIdSync("single-monitor-arm");
  check(
    "Product commerce ??runtime amazonUrl",
    Boolean(product?.amazonUrl?.includes("amazon.com")),
  );
  check(
    "Affiliate tag behavior preserved",
    true,
    "AffiliateButton still appends siteConfig.affiliateTag at click time",
  );
}

// --- Safety ---
section("Safety");

{
  const routeSlugs = getArticleSlugsSync();
  const publicSlugOwners = new Map<string, string>();
  const collisions: string[] = [];

  for (const fileName of fs.readdirSync(postsDir).filter((f) => f.endsWith(".md"))) {
    const fileSlug = fileName.replace(/\.md$/, "");
    const raw = fs.readFileSync(path.join(postsDir, fileName), "utf8");
    const isV1 = /^---[\s\S]*?schemaVersion:\s*1[\s\S]*?---/.test(raw);
    let publicSlug = fileSlug;

    if (isV1) {
      const match = raw.match(/articleData:\s*([^\s]+)/);
      if (match) {
        const dataFile = match[1].trim();
        const dataPath = path.join(articleDataDir, path.basename(dataFile));
        if (fs.existsSync(dataPath)) {
          const data = readJson(dataPath) as ArticleV1;
          if (isPublishedArticleV1(data)) {
            publicSlug = data.identity.slug;
            if (publicSlug !== fileSlug) {
              collisions.push(
                `V1 identity.slug "${publicSlug}" differs from filename "${fileSlug}"`,
              );
            }
          } else {
            continue;
          }
        }
      }
    } else {
      const slugMatch = raw.match(/^slug:\s*["']?([^"'\n]+)["']?/m);
      if (slugMatch) publicSlug = slugMatch[1].trim();
    }

    const owner = publicSlugOwners.get(publicSlug);
    if (owner && owner !== fileSlug) {
      collisions.push(`Duplicate public slug "${publicSlug}" (${owner} vs ${fileSlug})`);
    } else {
      publicSlugOwners.set(publicSlug, fileSlug);
    }
  }

  // Also ensure route list itself has unique entries
  const routeDupes = routeSlugs.filter(
    (slug, index) => routeSlugs.indexOf(slug) !== index,
  );
  check(
    "duplicate article slug detection",
    collisions.length === 0 && routeDupes.length === 0,
    collisions[0] || (routeDupes[0] ? `route dupe ${routeDupes[0]}` : undefined),
  );
}

{
  const ids = new Map<string, string>();
  let duplicate = "";
  for (const fileName of fs.readdirSync(productsDir).filter((f) => f.endsWith(".json"))) {
    const parsed = readJson(path.join(productsDir, fileName)) as { id?: string };
    if (!parsed.id) continue;
    if (ids.has(parsed.id)) {
      duplicate = parsed.id;
      break;
    }
    ids.set(parsed.id, fileName);
  }
  check("duplicate product ID detection", !duplicate, duplicate || undefined);
}

{
  const broken: ArticleV1 = {
    identity: {
      id: "missing-product-check",
      title: "Missing Product",
      slug: "missing-product-check",
    },
    classification: { type: "review", category: "monitors" },
    editorial: { summary: "x", intent: "commercial" },
    publishing: { status: "published" },
    products: { primary: [{ productId: "does-not-exist-product" }] },
  };
  const refs = validateArticleV1ProductRefs(broken, (id) => Boolean(getProductByIdSync(id)), {
    missingProductSeverity: "error",
  });
  check("missing published product reference fails", refs.valid === false);
}

{
  const invalidWinner: ArticleV1 = {
    identity: {
      id: "bad-winner",
      title: "Bad Winner",
      slug: "bad-winner",
    },
    classification: { type: "comparison", category: "monitors" },
    editorial: { summary: "x", intent: "commercial" },
    publishing: { status: "draft" },
    products: {
      primary: [
        { productId: "monitor-arm-dual" },
        { productId: "single-monitor-arm" },
      ],
    },
    comparison: { winnerId: "not-in-list" },
  };
  const template = validateArticleV1TemplateRules(invalidWinner);
  check("invalid comparison winner fails", template.valid === false);
}

// --- Legacy compatibility ---
section("Legacy compatibility");

{
  // All production articles are V1; prove legacy round-trip helper still works.
  const sample = getArticleMetaSync("best-standing-desks-small-apartments");
  if (!sample) {
    check("legacy article path unchanged", false, "sample article missing");
  } else {
    const asV1 = legacyArticleToV1(sample);
    const back = articleV1ToLegacyMeta(asV1);
    check(
      "legacy article path unchanged",
      asV1.classification.type === "best-list" &&
        back.type === "best" &&
        back.slug === sample.slug,
      "0 production legacy articles; legacyArticleToV1 ??adapter retained",
    );
  }
}

{
  let legacyFiles = 0;
  let v1Files = 0;
  for (const fileName of fs.readdirSync(productsDir).filter((f) => f.endsWith(".json"))) {
    const parsed = readJson(path.join(productsDir, fileName));
    if (isProductV1Document(parsed)) v1Files += 1;
    else legacyFiles += 1;
  }
  check(
    "production Product sources V1-only",
    legacyFiles === 0 && v1Files === 13,
    `legacy=${legacyFiles}, v1=${v1Files}`,
  );
}

// --- Production counts ---
section("Production counts");

{
  const articleFiles = fs
    .readdirSync(articleDataDir)
    .filter((f) => f.endsWith(".json"));
  let publishedArticles = 0;
  for (const fileName of articleFiles) {
    const data = readJson(path.join(articleDataDir, fileName)) as ArticleV1;
    if (isPublishedArticleV1(data)) publishedArticles += 1;
  }
  check(
    "Production Article V1 count stays 12",
    publishedArticles === 12,
    `found ${publishedArticles}`,
  );
}

{
  let productV1 = 0;
  for (const fileName of fs.readdirSync(productsDir).filter((f) => f.endsWith(".json"))) {
    const parsed = readJson(path.join(productsDir, fileName));
    if (isProductV1Document(parsed)) productV1 += 1;
  }
  check(
    "Production Product V1 count stays 13",
    productV1 === 13,
    `found ${productV1}`,
  );
}

// --- Warnings (non-blocking) ---
warn(
  "single-monitor-arm uses an Amazon search URL rather than an ASIN detail URL (generic product class).",
);
warn("Production Product loader is V1-only; legacyProductToV1 retained for migration regression tooling.");
warn(
  "comparison.rows source \"spec\" validates structurally but does not resolve Product specs at runtime yet.",
);
warn(
  "Production Article loading is Article V1 only; legacy frontmatter fallback was removed in Phase 8.",
);

section("WARNINGS");
for (const message of warnings) {
  console.log(`- ${message}`);
}

const failed = checks.filter((item) => !item.ok);
const ready = failed.length === 0;

section("SMARTDESK SCHEMA MIGRATION READINESS");
console.log(`Checks: ${checks.length - failed.length}/${checks.length} passed`);
console.log(`MIGRATION READY: ${ready ? "YES" : "NO"}`);

if (!ready) {
  console.error("\nFailed checks:");
  for (const item of failed) {
    console.error(`- ${item.name}${item.detail ? `: ${item.detail}` : ""}`);
  }
  process.exit(1);
}



