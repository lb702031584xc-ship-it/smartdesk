import { revalidatePath } from "next/cache";
import { isPublishedArticleV1 } from "@/lib/article-schema";
import { listArticlesV1 } from "@/lib/content/articles";
import type { ArticleV1 } from "@/types/article-v1";

export type RevalidationOutcome = {
  attempted: boolean;
  ok: boolean;
  paths: string[];
  error?: string;
};

export type ArticleRevalidationInput = {
  slug: string;
  previousStatus: ArticleV1["publishing"]["status"];
  nextStatus: ArticleV1["publishing"]["status"];
  previousSlug?: string;
  featuredChanged?: boolean;
  listingFieldsChanged?: boolean;
  category?: string;
};

function articleReferencesProduct(article: ArticleV1, productId: string): boolean {
  return (article.products?.primary ?? []).some((ref) => ref.productId === productId);
}

export async function findPublishedArticleSlugsReferencingProduct(
  productId: string,
): Promise<string[]> {
  const articles = await listArticlesV1();
  return articles
    .filter((article) => isPublishedArticleV1(article) && articleReferencesProduct(article, productId))
    .map((article) => article.identity.slug);
}

/** Pure path planner — testable without Next cache APIs. */
export function collectArticleRevalidationPaths(input: ArticleRevalidationInput): string[] {
  const paths = new Set<string>();
  const wasPublic = input.previousStatus === "published";
  const isPublic = input.nextStatus === "published";

  if (wasPublic || isPublic) {
    paths.add(`/blog/${input.slug}`);
  }
  if (input.previousSlug && input.previousSlug !== input.slug && wasPublic) {
    paths.add(`/blog/${input.previousSlug}`);
  }

  const listingsNeedRefresh =
    Boolean(input.listingFieldsChanged) ||
    Boolean(input.featuredChanged) ||
    input.previousStatus !== input.nextStatus;

  if (listingsNeedRefresh) {
    paths.add("/");
    paths.add("/blog");
    paths.add("/sitemap.xml");
    if (input.category) {
      paths.add(`/category/${input.category}`);
    }
  }

  return [...paths];
}

export function collectProductRevalidationPaths(options: {
  articleSlugs: string[];
  category?: string;
  featuredChanged?: boolean;
}): string[] {
  const paths = new Set<string>();
  for (const slug of options.articleSlugs) {
    paths.add(`/blog/${slug}`);
  }
  if (options.featuredChanged) {
    paths.add("/");
    paths.add("/best-products");
    paths.add("/reviews");
  }
  if (options.category) {
    paths.add(`/category/${options.category}`);
  }
  return [...paths];
}

async function runRevalidation(paths: string[]): Promise<RevalidationOutcome> {
  if (paths.length === 0) {
    return { attempted: false, ok: true, paths: [] };
  }
  try {
    for (const path of paths) {
      revalidatePath(path);
    }
    return { attempted: true, ok: true, paths };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { attempted: true, ok: false, paths, error: message };
  }
}

export async function revalidateArticlePublicContent(
  input: ArticleRevalidationInput,
): Promise<RevalidationOutcome> {
  return runRevalidation(collectArticleRevalidationPaths(input));
}

export async function revalidateProductPublicContent(options: {
  productId: string;
  category?: string;
  featuredChanged?: boolean;
}): Promise<RevalidationOutcome> {
  const articleSlugs = await findPublishedArticleSlugsReferencingProduct(options.productId);
  return runRevalidation(
    collectProductRevalidationPaths({
      articleSlugs,
      category: options.category,
      featuredChanged: options.featuredChanged,
    }),
  );
}

export function revalidationWarning(outcome: RevalidationOutcome): string | undefined {
  if (!outcome.attempted) return undefined;
  if (outcome.ok) return undefined;
  return "Saved, but public page refresh failed.";
}
