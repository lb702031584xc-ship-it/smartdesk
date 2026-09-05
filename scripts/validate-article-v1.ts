/**
 * Article Schema V1 checks for the fixture and production article-data files.
 *
 * Run: npm run validate:article-v1
 */
import fs from "fs";
import path from "path";
import { getArticleMetaSync } from "../src/lib/articles";
import {
  articleV1ToLegacyMeta,
  isArticleV1,
  isPublishedArticleV1,
  roleToLegacyBadge,
  validateArticleV1,
  validateArticleV1ProductRefs,
  validateArticleV1TemplateRules,
} from "../src/lib/article-schema";
import { getProductByIdSync } from "../src/lib/products";
import { buildArticleMetadata } from "../src/lib/seo";
import type { ArticleV1 } from "../src/types/article-v1";

function fail(message: string): never {
  console.error(`[article-v1] ${message}`);
  process.exit(1);
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
}

function lookupProduct(productId: string) {
  return Boolean(getProductByIdSync(productId));
}

function validateFile(
  filePath: string,
  options: { missingProductSeverity: "warning" | "error" },
): ArticleV1 {
  const parsed = readJson(filePath);
  const structural = validateArticleV1(parsed);
  if (!structural.valid) {
    fail(
      `${path.basename(filePath)} failed structural validation:\n- ${structural.errors.join("\n- ")}`,
    );
  }

  const template = validateArticleV1TemplateRules(parsed as ArticleV1);
  if (!template.valid) {
    fail(
      `${path.basename(filePath)} failed template validation:\n- ${template.errors.join("\n- ")}`,
    );
  }
  for (const warning of template.warnings) {
    console.warn(`[article-v1] ${path.basename(filePath)}: ${warning}`);
  }

  if (!isArticleV1(parsed)) {
    fail(`${path.basename(filePath)} failed isArticleV1() guard.`);
  }

  const productCheck = validateArticleV1ProductRefs(parsed, lookupProduct, {
    missingProductSeverity: options.missingProductSeverity,
  });

  if (!productCheck.valid) {
    fail(
      `${path.basename(filePath)} missing products:\n- ${productCheck.errors.join("\n- ")}`,
    );
  }

  if (productCheck.warnings.length > 0) {
    console.warn(
      `[article-v1] ${path.basename(filePath)} warnings:\n- ${productCheck.warnings.join("\n- ")}`,
    );
  }

  return parsed;
}

const fixturePath = path.join(
  process.cwd(),
  "content/examples/article-schema-v1-example.json",
);
const fixture = validateFile(fixturePath, { missingProductSeverity: "warning" });
const fixtureMeta = articleV1ToLegacyMeta(fixture);
const fixturePrimary = fixture.products?.primary?.[0];

if (fixtureMeta.type !== "best") {
  fail(`Expected adapter type "best", got "${fixtureMeta.type}".`);
}

if (!fixturePrimary) {
  fail("Example fixture must include products.primary[0].");
}

if (fixtureMeta.productRefs[0]?.id !== fixturePrimary.productId) {
  fail("productId did not map to ProductRef.id.");
}

if (fixtureMeta.productRefs[0]?.badge !== roleToLegacyBadge(fixturePrimary.role)) {
  fail("role did not map to legacy badge.");
}

console.log("[article-v1] fixture valid");
console.log(`  type: ${fixture.classification.type} ??${fixtureMeta.type}`);
console.log(`  productId: ${fixturePrimary.productId} ??ProductRef.id`);

const richFixturePath = path.join(
  process.cwd(),
  "content/examples/article-v1-rich-capability-fixture.json",
);
const richFixture = validateFile(richFixturePath, {
  missingProductSeverity: "warning",
});
const richMeta = articleV1ToLegacyMeta(richFixture);
if (richMeta.type !== "guide") {
  fail(`Rich fixture expected guide, got "${richMeta.type}".`);
}
if (richMeta.faq.length < 1) {
  fail("Rich fixture FAQ did not adapt.");
}
if (richMeta.related?.length !== 1) {
  fail("Rich fixture relatedLinks did not adapt.");
}
if (isPublishedArticleV1(richFixture)) {
  fail("Rich fixture must remain unpublished.");
}
console.log(
  `[article-v1] rich fixture valid: guide, faq=${richMeta.faq.length}, related=${richMeta.related?.length ?? 0}`,
);

const productionDir = path.join(process.cwd(), "content/article-data");
if (fs.existsSync(productionDir)) {
  const files = fs
    .readdirSync(productionDir)
    .filter((fileName) => fileName.endsWith(".json"));

  for (const fileName of files) {
    const fullPath = path.join(productionDir, fileName);
    const article = validateFile(fullPath, {
      missingProductSeverity: isPublishedArticleV1(
        JSON.parse(fs.readFileSync(fullPath, "utf8")) as ArticleV1,
      )
        ? "error"
        : "warning",
    });
    const meta = articleV1ToLegacyMeta(article);

    if (
      isPublishedArticleV1(article) &&
      meta.productRefs.length === 0 &&
      (article.classification.type === "best-list" ||
        article.classification.type === "review" ||
        article.classification.type === "comparison")
    ) {
      fail(`${fileName}: published commercial V1 article has no product refs.`);
    }

    console.log(
      `[article-v1] production ${fileName}: ${article.publishing.status} (${meta.type}, ${meta.productRefs.length} products)`,
    );

    if (article.seo?.metaTitle?.trim()) {
      if (meta.seoTitle !== article.seo.metaTitle.trim()) {
        fail(`${fileName}: seo.metaTitle did not map to seoTitle.`);
      }
      if (meta.title !== article.identity.title) {
        fail(`${fileName}: identity.title must remain the H1/title field.`);
      }
      console.log(
        `  seoTitle: "${meta.seoTitle}" (H1 title remains "${meta.title}")`,
      );
    }

    if (article.seo?.metaDescription?.trim()) {
      if (meta.description !== article.seo.metaDescription.trim()) {
        fail(`${fileName}: seo.metaDescription did not map to description.`);
      }
    }

    if (typeof article.seo?.noindex === "boolean") {
      if (meta.noindex !== article.seo.noindex) {
        fail(`${fileName}: seo.noindex did not map to noindex.`);
      }
      console.log(`  noindex: ${meta.noindex}`);
    }

    if (article.seo?.canonical?.trim()) {
      if (meta.seoCanonical !== article.seo.canonical.trim()) {
        fail(`${fileName}: seo.canonical did not map to seoCanonical.`);
      }
      console.log(`  seoCanonical: ${meta.seoCanonical}`);
    } else if (meta.seoCanonical) {
      fail(`${fileName}: empty/missing canonical should not set seoCanonical.`);
    }

    if (isPublishedArticleV1(article)) {
      const metadata = buildArticleMetadata(meta);
      const expectedTitle = meta.seoTitle || meta.title;
      if (metadata.title !== expectedTitle) {
        fail(
          `${fileName}: buildArticleMetadata title expected "${expectedTitle}", got "${String(metadata.title)}".`,
        );
      }
      if (metadata.description !== meta.description) {
        fail(`${fileName}: buildArticleMetadata description mismatch.`);
      }
      if (metadata.alternates?.canonical !== (meta.seoCanonical || `/blog/${meta.slug}`)) {
        fail(`${fileName}: buildArticleMetadata canonical mismatch.`);
      }
      if (metadata.robots && typeof metadata.robots === "object") {
        const robots = metadata.robots as { index?: boolean; follow?: boolean };
        if (robots.index !== (meta.noindex !== true)) {
          fail(`${fileName}: buildArticleMetadata robots.index mismatch.`);
        }
        if (robots.follow !== true) {
          fail(`${fileName}: buildArticleMetadata robots.follow should stay true.`);
        }
      }
      console.log(
        `  metadata: title="${String(metadata.title)}", canonical=${String(metadata.alternates?.canonical)}, index=${meta.noindex !== true}`,
      );
    }
  }
}

// After Batch 2, all production articles are V1. Verify title-fallback SEO
// still works for migrations that intentionally omit metaTitle.
const migrated = getArticleMetaSync("best-standing-desks-small-apartments");
if (!migrated) {
  fail("Migrated article best-standing-desks-small-apartments was not found.");
}
if (migrated.seoTitle) {
  fail("Batch 2 standing-desks article should not invent seoTitle.");
}
const migratedMetadata = buildArticleMetadata(migrated);
if (migratedMetadata.title !== migrated.title) {
  fail("Without metaTitle, metadata title should remain article.title.");
}
if (migratedMetadata.alternates?.canonical !== `/blog/${migrated.slug}`) {
  fail("Without seoCanonical, canonical should remain /blog/{slug}.");
}
if (
  !migratedMetadata.robots ||
  typeof migratedMetadata.robots !== "object" ||
  (migratedMetadata.robots as { index?: boolean }).index !== true
) {
  fail("Migrated article robots.index should remain true.");
}
console.log(
  `[article-v1] title-fallback SEO preserved: title="${String(migratedMetadata.title)}", canonical=${String(migratedMetadata.alternates?.canonical)}`,
);

