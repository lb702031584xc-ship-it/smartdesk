/**
 * Native ArticleV1 rendering pipeline (Phase 29).
 *
 * ArticleV1 → validate → resolve products → resolve graph → ArticleViewModel
 *
 * Read-only. Markdown body is preserved (HTML is derived for presentation).
 * Default public path remains legacy via feature flag.
 */
import readingTime from "reading-time";
import type { Metadata } from "next";
import type { ArticleV1 } from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";
import type {
  ArticleRendererMode,
  ArticleViewModel,
  ArticleViewProduct,
  ArticleViewRelatedArticle,
  ArticleViewSeo,
} from "@/types/article-view-model";
import {
  articleV1ToLegacyMeta,
  isPublishedArticleV1,
  roleToLegacyBadge,
  validateArticleV1,
  validateArticleV1ProductRefs,
  validateArticleV1TemplateRules,
} from "@/lib/article-schema";
import { resolveArticleWithProducts } from "@/lib/article-products";
import {
  buildTopicClusters,
  resolveArticleContentGraph,
  resolveArticleTopicId,
} from "@/lib/content-graph";
import { getArticleV1BySlug, listArticlesV1 } from "@/lib/content/articles";
import { listProductsV1 } from "@/lib/content/products";
import { listFilesystemProductsV1 } from "@/lib/content/filesystem-products";
import { isDatabaseContentStore } from "@/lib/content/store-config";
import { renderArticleMarkdown } from "@/lib/markdown/render-article-body";
import { productV1ToLegacyProduct } from "@/lib/product-schema";
import { absoluteUrl, siteConfig } from "@/lib/site";
import type { ArticleMeta, ResolvedArticle } from "@/types/article";
import type { ResolvedProduct } from "@/types/product";

export type BuildArticleViewModelOptions = {
  articles?: ArticleV1[];
  products?: ProductV1Document[];
  /** When true, missing products throw (published default). */
  requireProducts?: boolean;
};

function productLookupMap(
  products: ProductV1Document[],
): Map<string, ProductV1Document> {
  return new Map(products.map((p) => [p.id, p]));
}

function buildViewSeo(article: ArticleV1): ArticleViewSeo {
  const meta = articleV1ToLegacyMeta(article);
  const path = `/blog/${article.identity.slug}`;
  const canonical =
    article.seo?.canonical?.trim() ||
    meta.seoCanonical?.trim() ||
    path;

  return {
    metaTitle: article.seo?.metaTitle?.trim() || article.identity.title,
    metaDescription:
      article.seo?.metaDescription?.trim() ||
      article.editorial.summary?.trim() ||
      meta.description,
    primaryKeyword: article.seo?.primaryKeyword,
    secondaryKeywords: article.seo?.secondaryKeywords ?? [],
    canonical,
    noindex: article.seo?.noindex === true,
    keywords: article.classification.tags ?? [],
  };
}

function toViewProducts(
  article: ArticleV1,
  products: ProductV1Document[],
): { products: ArticleViewProduct[]; missingProductIds: string[] } {
  const byId = productLookupMap(products);
  const joined = resolveArticleWithProducts(article, (id) => byId.get(id));

  const viewProducts: ArticleViewProduct[] = joined.placements.map((placement) => ({
    placement,
    product: placement.product,
    rank: placement.ref.rank,
    role: placement.ref.role,
    summary: placement.ref.summary,
    verdict: placement.ref.verdict,
    bestFor: placement.ref.bestFor,
  }));

  return {
    products: viewProducts,
    missingProductIds: joined.missingProductIds,
  };
}

/**
 * Pure pipeline: ArticleV1 + Markdown body → ArticleViewModel.
 */
export function buildArticleViewModel(
  article: ArticleV1,
  body: string,
  options?: BuildArticleViewModelOptions,
): ArticleViewModel {
  const structural = validateArticleV1(article);
  if (!structural.valid) {
    throw new Error(
      `[article-renderer] Invalid Article V1 (${article.identity?.id ?? "unknown"}):\n- ${structural.errors.join("\n- ")}`,
    );
  }

  const template = validateArticleV1TemplateRules(article);
  if (!template.valid) {
    throw new Error(
      `[article-renderer] Invalid Article V1 template (${article.identity.id}):\n- ${template.errors.join("\n- ")}`,
    );
  }

  const products = options?.products ?? [];
  const articles = options?.articles ?? [article];
  const requireProducts =
    options?.requireProducts ?? isPublishedArticleV1(article);

  const productCheck = validateArticleV1ProductRefs(
    article,
    (productId) => products.some((p) => p.id === productId),
    { missingProductSeverity: requireProducts ? "error" : "warning" },
  );
  if (!productCheck.valid) {
    throw new Error(
      `[article-renderer] Missing products (${article.identity.id}):\n- ${productCheck.errors.join("\n- ")}`,
    );
  }

  const { products: viewProducts, missingProductIds } = toViewProducts(
    article,
    products,
  );
  if (requireProducts && missingProductIds.length > 0) {
    throw new Error(
      `[article-renderer] Unresolved products (${article.identity.id}): ${missingProductIds.join(", ")}`,
    );
  }

  const graph = resolveArticleContentGraph(article, articles, products);
  const relatedArticles: ArticleViewRelatedArticle[] = graph.relatedArticles.map(
    (related) => ({
      id: related.identity.id,
      slug: related.identity.slug,
      title: related.identity.title,
      type: related.classification.type,
      summary: related.editorial.summary,
    }),
  );

  // Ensure topic cluster includes corpus-level membership when available
  const topics = buildTopicClusters(articles);
  const topicId = resolveArticleTopicId(article);
  const topic = topicId ? topics.get(topicId) ?? graph.topic : graph.topic;

  const contentHtml = renderArticleMarkdown(body);

  return {
    article,
    body,
    contentHtml,
    readingTime: readingTime(body).text,
    products: viewProducts,
    relatedArticles,
    topic,
    seo: buildViewSeo(article),
    publishing: article.publishing,
    document: { article, body },
  };
}

async function loadCorpus(): Promise<{
  articles: ArticleV1[];
  products: ProductV1Document[];
}> {
  const articles = await listArticlesV1();
  const products = isDatabaseContentStore()
    ? await listProductsV1()
    : listFilesystemProductsV1();
  return { articles, products };
}

/**
 * Load published article by slug through the native pipeline.
 */
export async function buildArticleViewModelBySlug(
  slug: string,
  options?: Omit<BuildArticleViewModelOptions, "articles" | "products">,
): Promise<ArticleViewModel> {
  const record = await getArticleV1BySlug(slug);
  if (!record) {
    throw new Error(`[article-renderer] Article not found: ${slug}`);
  }
  if (!isPublishedArticleV1(record.article)) {
    throw new Error(`[article-renderer] Article not published: ${slug}`);
  }

  const { articles, products } = await loadCorpus();
  return buildArticleViewModel(record.article, record.body, {
    ...options,
    articles,
    products,
    requireProducts: options?.requireProducts ?? true,
  });
}

/** Feature flag — default legacy. */
export function getArticleRendererMode(): ArticleRendererMode {
  const mode = process.env.ARTICLE_RENDERER_MODE?.trim().toLowerCase();
  if (mode === "native") return "native";
  return "legacy";
}

/**
 * Whether this slug should use the native renderer.
 * Native when ARTICLE_RENDERER_MODE=native, or slug is listed in
 * ARTICLE_RENDERER_NATIVE_SLUGS (comma-separated).
 */
export function shouldUseNativeArticleRenderer(slug: string): boolean {
  if (getArticleRendererMode() === "native") return true;
  const raw = process.env.ARTICLE_RENDERER_NATIVE_SLUGS?.trim() ?? "";
  if (!raw) return false;
  const allow = new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return allow.has(slug);
}

/**
 * SEO Metadata from ViewModel — must match legacy `buildArticleMetadata`.
 */
export function buildArticleMetadataFromViewModel(
  view: ArticleViewModel,
): Metadata {
  const path = `/blog/${view.article.identity.slug}`;
  const url = absoluteUrl(path);
  const metadataTitle = view.seo.metaTitle;
  const description = view.seo.metaDescription;
  const date = view.publishing.publishedAt ?? "";
  const updated = view.publishing.updatedAt ?? date;

  return {
    title: metadataTitle,
    description,
    keywords: view.seo.keywords,
    authors: [{ name: view.publishing.author ?? siteConfig.author }],
    alternates: {
      canonical: view.seo.canonical,
    },
    openGraph: {
      type: "article",
      title: metadataTitle,
      description,
      url,
      publishedTime: date,
      modifiedTime: updated,
      tags: view.seo.keywords,
      siteName: siteConfig.name,
    },
    twitter: {
      card: "summary_large_image",
      title: metadataTitle,
      description,
    },
    robots: {
      index: view.seo.noindex !== true,
      follow: true,
    },
  };
}

/**
 * Bridge ViewModel → legacy ResolvedArticle so existing templates produce
 * identical public HTML (no UI redesign). Native path still owns resolution.
 */
export function viewModelToLegacyResolvedArticle(
  view: ArticleViewModel,
): ResolvedArticle {
  const meta = articleV1ToLegacyMeta(view.article);
  const articleMeta: ArticleMeta = {
    ...meta,
    readingTime: view.readingTime,
  };

  const resolvedProducts: ResolvedProduct[] = view.products.map((item) => {
    const legacy = productV1ToLegacyProduct(item.product);
    return {
      ...legacy,
      rank: item.rank,
      badge: roleToLegacyBadge(item.role),
      summary: item.summary,
      verdict: item.verdict ?? legacy.verdict,
      bestFor: item.bestFor ?? legacy.bestFor,
      priceLabel: legacy.priceRange,
    };
  });

  return {
    ...articleMeta,
    contentHtml: view.contentHtml,
    resolvedProducts,
    resolvedProduct:
      view.article.classification.type === "review"
        ? resolvedProducts[0]
        : undefined,
  };
}

/**
 * Comparable SEO snapshot for legacy vs native parity tests.
 */
export function seoParitySnapshotFromMeta(meta: ArticleMeta): Record<string, unknown> {
  const path = `/blog/${meta.slug}`;
  return {
    title: meta.seoTitle?.trim() || meta.title,
    description: meta.description,
    canonical: meta.seoCanonical?.trim() || path,
    noindex: meta.noindex === true,
    keywords: meta.tags ?? [],
    slug: meta.slug,
    type: meta.type,
    productIds: meta.productIds,
  };
}

export function seoParitySnapshotFromView(
  view: ArticleViewModel,
): Record<string, unknown> {
  const meta = articleV1ToLegacyMeta(view.article);
  return {
    title: view.seo.metaTitle,
    description: view.seo.metaDescription,
    canonical: view.seo.canonical || `/blog/${view.article.identity.slug}`,
    noindex: view.seo.noindex,
    keywords: view.seo.keywords,
    slug: view.article.identity.slug,
    type: meta.type,
    productIds: view.products.map((p) => p.product.id),
  };
}
