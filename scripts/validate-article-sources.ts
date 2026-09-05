/**
 * Production Article source pairing checks.
 *
 * Run: npm run validate:article-sources
 *
 * Invariant: every production Markdown post must have Article V1 metadata,
 * and every production Article V1 JSON must have a matching Markdown body.
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { isArticleV1Pointer } from "../src/lib/articles";
import {
  isPublishedArticleV1,
  validateArticleV1,
} from "../src/lib/article-schema";
import type { ArticleV1 } from "../src/types/article-v1";

function fail(message: string): never {
  console.error(`[article-sources] ${message}`);
  process.exit(1);
}

const postsDir = path.join(process.cwd(), "content/posts");
const articleDataDir = path.join(process.cwd(), "content/article-data");

const markdownFiles = fs
  .readdirSync(postsDir)
  .filter((fileName) => fileName.endsWith(".md"))
  .sort();
const jsonFiles = fs
  .readdirSync(articleDataDir)
  .filter((fileName) => fileName.endsWith(".json"))
  .sort();

const markdownSlugs = markdownFiles.map((f) => f.replace(/\.md$/, ""));
const jsonSlugs = jsonFiles.map((f) => f.replace(/\.json$/, ""));

const errors: string[] = [];
const publicSlugOwners = new Map<string, string>();

for (const fileSlug of markdownSlugs) {
  if (!jsonSlugs.includes(fileSlug)) {
    errors.push(`Markdown without matching V1 JSON: ${fileSlug}.md`);
  }

  const raw = fs.readFileSync(path.join(postsDir, `${fileSlug}.md`), "utf8");
  const { data } = matter(raw);

  if (!isArticleV1Pointer(data)) {
    errors.push(
      `${fileSlug}: missing Article V1 pointer (schemaVersion: 1 + articleData)`,
    );
    continue;
  }

  const dataFile = path.basename(data.articleData);
  if (dataFile !== `${fileSlug}.json`) {
    errors.push(
      `${fileSlug}: articleData must be "${fileSlug}.json", got "${dataFile}"`,
    );
  }

  const dataPath = path.join(articleDataDir, dataFile);
  if (!fs.existsSync(dataPath)) {
    errors.push(`${fileSlug}: articleData file not found: ${dataFile}`);
    continue;
  }

  const article = JSON.parse(fs.readFileSync(dataPath, "utf8")) as ArticleV1;
  const structural = validateArticleV1(article);
  if (!structural.valid) {
    errors.push(
      `${fileSlug}: invalid Article V1: ${structural.errors.join("; ")}`,
    );
    continue;
  }

  if (article.identity.slug !== fileSlug) {
    errors.push(
      `${fileSlug}: identity.slug "${article.identity.slug}" must match Markdown filename`,
    );
  }

  const owner = publicSlugOwners.get(article.identity.slug);
  if (owner && owner !== fileSlug) {
    errors.push(
      `Duplicate public slug "${article.identity.slug}" (${owner} vs ${fileSlug})`,
    );
  } else {
    publicSlugOwners.set(article.identity.slug, fileSlug);
  }
}

for (const jsonSlug of jsonSlugs) {
  if (!markdownSlugs.includes(jsonSlug)) {
    errors.push(`V1 metadata without Markdown: ${jsonSlug}.json`);
  }

  const article = JSON.parse(
    fs.readFileSync(path.join(articleDataDir, `${jsonSlug}.json`), "utf8"),
  ) as ArticleV1;

  if (isPublishedArticleV1(article) && !markdownSlugs.includes(jsonSlug)) {
    errors.push(
      `published Article V1 "${jsonSlug}" has no matching Markdown body`,
    );
  }
}

if (errors.length > 0) {
  fail(`Article source errors:\n- ${errors.join("\n- ")}`);
}

console.log(`[article-sources] Markdown posts: ${markdownFiles.length}`);
console.log(`[article-sources] Article V1 JSON: ${jsonFiles.length}`);
console.log("[article-sources] Markdown without V1 metadata: 0");
console.log("[article-sources] V1 metadata without Markdown: 0");
console.log("[article-sources] duplicate public slugs: 0");
console.log("[article-sources] production Article sources OK");
