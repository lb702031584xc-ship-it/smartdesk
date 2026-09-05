import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/article/JsonLd";
import { ArticleTemplateRenderer } from "@/components/article/templates/ArticleTemplateRenderer";
import { NativeArticleRenderer } from "@/components/article/native/NativeArticleRenderer";
import { getCategoryBySlug } from "@/lib/categories";
import {
  getAllArticles,
  getArticleSlugs,
  getRelatedArticles,
  getResolvedArticle,
} from "@/lib/articles";
import {
  buildArticleMetadataFromViewModel,
  buildArticleViewModelBySlug,
  shouldUseNativeArticleRenderer,
} from "@/lib/article-renderer";
import { buildArticleJsonLd, buildArticleMetadata } from "@/lib/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const slugs = await getArticleSlugs();
  return slugs.map((slug) => ({ slug }));
}

export const dynamicParams = true;

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    if (shouldUseNativeArticleRenderer(slug)) {
      const view = await buildArticleViewModelBySlug(slug);
      return buildArticleMetadataFromViewModel(view);
    }
    const article = await getResolvedArticle(slug);
    return buildArticleMetadata(article);
  } catch {
    return {
      title: "Guide not found",
    };
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const slugs = await getArticleSlugs();

  if (!slugs.includes(slug)) {
    notFound();
  }

  const useNative = shouldUseNativeArticleRenderer(slug);

  if (useNative) {
    const view = await buildArticleViewModelBySlug(slug);
    const category = getCategoryBySlug(view.article.classification.category ?? "");
    const legacyForRelated = viewModelAsRelatedSource(view);
    const relatedPosts = await getRelatedArticles(legacyForRelated, 3);
    const fallbackRelated =
      relatedPosts.length > 0
        ? relatedPosts
        : (await getAllArticles())
            .filter((post) => post.slug !== view.article.identity.slug)
            .slice(0, 2);

    return (
      <NativeArticleRenderer
        view={view}
        categoryName={category?.name}
        categoryHref={category ? `/category/${category.slug}` : undefined}
        relatedPosts={fallbackRelated}
      />
    );
  }

  const article = await getResolvedArticle(slug);
  const category = getCategoryBySlug(article.category);
  const relatedPosts = await getRelatedArticles(article, 3);

  const fallbackRelated =
    article.related && article.related.length > 0
      ? []
      : relatedPosts.length > 0
        ? relatedPosts
        : (await getAllArticles())
            .filter((post) => post.slug !== article.slug)
            .slice(0, 2);

  return (
    <>
      <JsonLd data={buildArticleJsonLd(article)} />
      <ArticleTemplateRenderer
        article={article}
        categoryName={category?.name}
        categoryHref={category ? `/category/${category.slug}` : undefined}
        relatedPosts={fallbackRelated}
      />
    </>
  );
}

/** Minimal ArticleMeta-shaped object for related-article helpers. */
function viewModelAsRelatedSource(view: Awaited<ReturnType<typeof buildArticleViewModelBySlug>>) {
  return {
    slug: view.article.identity.slug,
    title: view.article.identity.title,
    description: view.seo.metaDescription,
    date: view.publishing.publishedAt ?? "",
    updated: view.publishing.updatedAt,
    category: view.article.classification.category ?? "",
    type: "best" as const,
    readingTime: view.readingTime,
    productIds: view.products.map((p) => p.product.id),
    productRefs: [],
    faq: [],
    template: "best" as const,
    faqs: [],
    tags: view.article.classification.tags,
  };
}
