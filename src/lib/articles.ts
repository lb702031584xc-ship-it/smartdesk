import { renderArticleMarkdown } from "@/lib/markdown/render-article-body";
import readingTime from "reading-time";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import {
  articleV1ToLegacyMeta,
  isArticleV1,
  isPublishedArticleV1,
  validateArticleV1,
  validateArticleV1ProductRefs,
  validateArticleV1TemplateRules,
} from "@/lib/article-schema";
import {
  getArticleV1BySlug,
  listArticlesV1,
  listPublishedArticleSlugs,
} from "@/lib/content/articles";
import { isDatabaseContentStore } from "@/lib/content/store-config";
import {
  getFilesystemArticleV1,
  getFilesystemPublishedSlugs,
} from "@/lib/content/filesystem-articles";
import { resolveProductRefs, resolveProductRefsSync } from "@/lib/resolve-products";
import type {
  Article,
  ArticleFrontmatter,
  ArticleMeta,
  ArticleType,
  ResolvedArticle,
} from "@/types/article";
import type { ArticleV1 } from "@/types/article-v1";

const postsDirectory = path.join(process.cwd(), "content/posts");

type ArticleMetaCache = {
  bySlug: Map<string, ArticleMeta>;
  list: ArticleMeta[];
};

let metaCache: ArticleMetaCache | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isArticleV1Pointer(
  data: unknown,
): data is { schemaVersion: 1; articleData: string } {
  return (
    isRecord(data) &&
    data.schemaVersion === 1 &&
    typeof data.articleData === "string" &&
    data.articleData.trim().length > 0
  );
}

async function parseProductionArticleV1(
  raw: unknown,
  sourceLabel: string,
): Promise<ArticleV1> {
  const structural = validateArticleV1(raw);
  if (!structural.valid) {
    throw new Error(
      `[articles] Invalid Article V1 (${sourceLabel}):\n- ${structural.errors.join("\n- ")}`,
    );
  }

  const template = validateArticleV1TemplateRules(raw as ArticleV1);
  if (!template.valid || !isArticleV1(raw)) {
    throw new Error(
      `[articles] Invalid Article V1 template (${sourceLabel}):\n- ${template.errors.join("\n- ")}`,
    );
  }

  if (isPublishedArticleV1(raw)) {
    await ensurePublishedProductIds();
    const productCheck = validateArticleV1ProductRefs(
      raw,
      (productId) => publishedProductIds.has(productId),
      { missingProductSeverity: "error" },
    );
    if (!productCheck.valid) {
      throw new Error(
        `[articles] Published Article V1 is missing products (${sourceLabel}):\n- ${productCheck.errors.join("\n- ")}`,
      );
    }
  }

  return raw;
}

let publishedProductIds = new Set<string>();

async function ensurePublishedProductIds() {
  const { listProductV1Ids } = await import("@/lib/content/products");
  publishedProductIds = new Set(await listProductV1Ids());
}

function v1MetaFromMarkdown(article: ArticleV1, markdownBody: string): ArticleMeta {
  const meta = articleV1ToLegacyMeta(article);
  if (!meta.slug || !meta.title || !meta.type) {
    throw new Error(
      `[articles] Article V1 adapter produced incomplete ArticleMeta for "${article.identity.id}".`,
    );
  }
  return {
    ...meta,
    readingTime: readingTime(markdownBody).text,
  };
}

function readMatter(slug: string) {
  const fullPath = path.join(postsDirectory, `${slug}.md`);
  const fileContents = fs.readFileSync(fullPath, "utf8");
  return matter(fileContents);
}

async function loadPublishedMetaFromFilesystemSlug(fileBasedSlug: string): Promise<ArticleMeta | null> {
  const { data, content } = readMatter(fileBasedSlug);
  if (!isArticleV1Pointer(data)) {
    throw new Error(
      `[articles] Production post "${fileBasedSlug}" must use Article V1 metadata.`,
    );
  }
  const record = getFilesystemArticleV1(fileBasedSlug);
  if (!record) {
    throw new Error(`[articles] Article V1 not found for slug: ${fileBasedSlug}`);
  }
  if (!isPublishedArticleV1(record.article)) return null;
  return v1MetaFromMarkdown(record.article, content);
}

async function buildMetaCache(): Promise<ArticleMetaCache> {
  await ensurePublishedProductIds();
  const bySlug = new Map<string, ArticleMeta>();

  if (isDatabaseContentStore()) {
    const articles = await listArticlesV1();
    for (const articleV1 of articles) {
      if (!isPublishedArticleV1(articleV1)) continue;
      const record = await getArticleV1BySlug(articleV1.identity.slug);
      if (!record) continue;
      const meta = v1MetaFromMarkdown(articleV1, record.body);
      bySlug.set(meta.slug, meta);
      bySlug.set(articleV1.identity.slug, meta);
    }
  } else {
    if (!fs.existsSync(postsDirectory)) {
      return { bySlug, list: [] };
    }
    for (const fileName of fs.readdirSync(postsDirectory).filter((f) => f.endsWith(".md"))) {
      const fileBasedSlug = fileName.replace(/\.md$/, "");
      const meta = await loadPublishedMetaFromFilesystemSlug(fileBasedSlug);
      if (!meta) continue;
      bySlug.set(meta.slug, meta);
      bySlug.set(fileBasedSlug, meta);
    }
  }

  const list = Array.from(
    new Map(Array.from(bySlug.values()).map((meta) => [meta.slug, meta])).values(),
  ).sort((a, b) => (a.date < b.date ? 1 : -1));

  return { bySlug, list };
}

async function getMetaCache() {
  if (!metaCache) {
    metaCache = await buildMetaCache();
  }
  return metaCache;
}

export function clearArticleCache() {
  metaCache = null;
  publishedProductIds = new Set();
}

export async function getAllArticles(): Promise<ArticleMeta[]> {
  return (await getMetaCache()).list;
}

export async function getArticleMeta(slug: string): Promise<ArticleMeta | undefined> {
  return (await getMetaCache()).bySlug.get(slug);
}

export async function getArticleSlugs(): Promise<string[]> {
  if (isDatabaseContentStore()) {
    return await listPublishedArticleSlugs();
  }
  return getFilesystemPublishedSlugs();
}

/** Sync filesystem slug list for validation scripts. */
export function getArticleSlugsSync(): string[] {
  return getFilesystemPublishedSlugs();
}

export async function getArticleBySlug(slug: string): Promise<Article> {
  await ensurePublishedProductIds();

  if (isDatabaseContentStore()) {
    const record = await getArticleV1BySlug(slug);
    if (!record || !isPublishedArticleV1(record.article)) {
      throw new Error(`Article not found: ${slug}`);
    }

    const articleV1 = await parseProductionArticleV1(record.article, record.sourceFile);
    const contentHtml = renderArticleMarkdown(record.body);

    return {
      ...v1MetaFromMarkdown(articleV1, record.body),
      contentHtml,
    };
  }

  const { data, content } = readMatter(slug);
  if (!isArticleV1Pointer(data)) {
    throw new Error(`[articles] Production post "${slug}" must use Article V1 metadata.`);
  }

  const record = getFilesystemArticleV1(slug);
  if (!record) {
    throw new Error(`Article not found: ${slug}`);
  }

  const articleV1 = await parseProductionArticleV1(record.article, record.sourceFile);
  if (!isPublishedArticleV1(articleV1)) {
    throw new Error(`Article not found: ${slug}`);
  }

  const contentHtml = renderArticleMarkdown(content);

  return {
    ...v1MetaFromMarkdown(articleV1, content),
    contentHtml,
  };
}

export async function getResolvedArticle(slug: string): Promise<ResolvedArticle> {
  const article = await getArticleBySlug(slug);
  const resolvedProducts = await resolveProductRefs(article.productRefs);
  const resolvedProduct =
    article.type === "review" ? resolvedProducts[0] : undefined;

  return {
    ...article,
    resolvedProducts,
    resolvedProduct,
  };
}

/** Sync filesystem resolution for validation scripts. */
export function getResolvedArticleSync(slug: string): ResolvedArticle {
  const article = getArticleBySlugSync(slug);
  const resolvedProducts = resolveProductRefsSync(article.productRefs);
  const resolvedProduct =
    article.type === "review" ? resolvedProducts[0] : undefined;

  return {
    ...article,
    resolvedProducts,
    resolvedProduct,
  };
}

/** Sync filesystem article load for validation scripts. */
export function getArticleBySlugSync(slug: string): Article {
  const { data, content } = readMatter(slug);
  if (!isArticleV1Pointer(data)) {
    throw new Error(`[articles] Production post "${slug}" must use Article V1 metadata.`);
  }

  const record = getFilesystemArticleV1(slug);
  if (!record) {
    throw new Error(`Article not found: ${slug}`);
  }

  // Sync validation uses preloaded product ids from filesystem
  const structural = validateArticleV1(record.article);
  if (!structural.valid) {
    throw new Error(`Invalid Article V1: ${structural.errors.join("; ")}`);
  }

  if (!isPublishedArticleV1(record.article)) {
    throw new Error(`Article not found: ${slug}`);
  }

  const contentHtml = renderArticleMarkdown(content);

  return {
    ...v1MetaFromMarkdown(record.article, content),
    contentHtml,
  };
}

export function getArticleMetaSync(slug: string): ArticleMeta | undefined {
  try {
    const { content } = readMatter(slug);
    const record = getFilesystemArticleV1(slug);
    if (!record || !isPublishedArticleV1(record.article)) return undefined;
    return v1MetaFromMarkdown(record.article, content);
  } catch {
    return undefined;
  }
}

export async function getFeaturedArticles() {
  const all = await getAllArticles();
  return all.filter((article) => article.featured);
}

export function getFeaturedArticlesSync(): ArticleMeta[] {
  const slugs = getFilesystemPublishedSlugs();
  return slugs
    .map((slug) => getArticleMetaSync(slug))
    .filter((article): article is ArticleMeta => Boolean(article))
    .filter((article) => article.featured);
}

export async function getArticlesByCategory(categorySlug: string) {
  const all = await getAllArticles();
  return all.filter((article) => article.category === categorySlug);
}

export async function getArticlesByType(type: ArticleType) {
  const all = await getAllArticles();
  return all.filter((article) => article.type === type);
}

export async function getRelatedArticles(article: ArticleMeta, limit = 3): Promise<ArticleMeta[]> {
  if (article.related && article.related.length > 0) {
    return [];
  }

  const all = await getAllArticles();
  return all
    .filter(
      (item) =>
        item.slug !== article.slug &&
        (item.category === article.category ||
          item.tags?.some((tag) => article.tags?.includes(tag))),
    )
    .slice(0, limit);
}

export const getPostSlugs = getArticleSlugs;
export const getAllPosts = getAllArticles;
export const getPostBySlug = getArticleBySlug;
export const getPostMetaFromFile = async (slug: string) => {
  const meta = await getArticleMeta(slug);
  if (!meta) throw new Error(`Article not found: ${slug}`);
  return meta;
};
export const getFeaturedPosts = getFeaturedArticles;
export const getPostsByCategory = getArticlesByCategory;
export const getRelatedPosts = getRelatedArticles;

export type { Article, ArticleMeta, ArticleFrontmatter, ResolvedArticle };
export type PostMeta = ArticleMeta;
export type Post = Article;
export type PostFrontmatter = ArticleFrontmatter;
