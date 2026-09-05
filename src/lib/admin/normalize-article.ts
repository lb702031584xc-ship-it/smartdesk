import type {
  ArticleComparisonRowV1,
  ArticleProductReferenceV1,
  ArticleV1,
} from "@/types/article-v1";
import {
  omitEmptyObject,
  parseOptionalNumber,
  trimToUndefined,
  uniqueStrings,
} from "./form-utils";

function normalizeProductRef(ref: ArticleProductReferenceV1): ArticleProductReferenceV1 {
  const rank = parseOptionalNumber(ref.rank);
  return {
    productId: ref.productId.trim(),
    rank: Number.isFinite(rank) ? rank : undefined,
    role: trimToUndefined(ref.role),
    summary: trimToUndefined(ref.summary),
    verdict: trimToUndefined(ref.verdict),
    bestFor: trimToUndefined(ref.bestFor),
  };
}

function normalizeComparisonRows(
  rows: ArticleComparisonRowV1[] | undefined,
): ArticleComparisonRowV1[] | undefined {
  if (!rows?.length) return undefined;
  return rows.map((row) => {
    const values = row.values
      ? Object.fromEntries(
          Object.entries(row.values)
            .map(([key, value]) => [key, value.trim()])
            .filter(([, value]) => value),
        )
      : undefined;
    if (row.source === "spec") {
      return {
        label: row.label.trim(),
        source: "spec" as const,
        specPath: row.specPath.trim(),
        values,
      };
    }
    return {
      label: row.label.trim(),
      source: "editorial" as const,
      values: values ?? {},
    };
  });
}

export function normalizeArticleV1(article: ArticleV1): ArticleV1 {
  const primary = article.products?.primary
    ?.map(normalizeProductRef)
    .filter((ref) => ref.productId);

  return {
    identity: {
      id: article.identity.id.trim(),
      title: article.identity.title.trim(),
      slug: article.identity.slug.trim(),
    },
    classification: {
      type: article.classification.type,
      category: trimToUndefined(article.classification.category),
      subcategory: trimToUndefined(article.classification.subcategory),
      tags: uniqueStrings(article.classification.tags),
    },
    editorial: {
      summary: trimToUndefined(article.editorial.summary),
      audience: uniqueStrings(article.editorial.audience),
      intent: article.editorial.intent,
      methodology: trimToUndefined(article.editorial.methodology),
    },
    seo: omitEmptyObject({
      metaTitle: trimToUndefined(article.seo?.metaTitle),
      metaDescription: trimToUndefined(article.seo?.metaDescription),
      primaryKeyword: trimToUndefined(article.seo?.primaryKeyword),
      secondaryKeywords: uniqueStrings(article.seo?.secondaryKeywords),
      canonical: trimToUndefined(article.seo?.canonical),
      noindex: article.seo?.noindex,
    }),
    products: omitEmptyObject({
      primary: primary && primary.length > 0 ? primary : undefined,
      winnerProductId: trimToUndefined(article.products?.winnerProductId),
      winnerReason: trimToUndefined(article.products?.winnerReason),
    }),
    commerce: omitEmptyObject({
      affiliateEnabled: article.commerce?.affiliateEnabled,
      disclosure: article.commerce?.disclosure,
      ctaStyle: trimToUndefined(article.commerce?.ctaStyle),
    }),
    media: omitEmptyObject({
      featuredImage: trimToUndefined(article.media?.featuredImage),
      ogImage: trimToUndefined(article.media?.ogImage),
      pinterestImage: trimToUndefined(article.media?.pinterestImage),
    }),
    publishing: {
      status: article.publishing.status,
      publishedAt: trimToUndefined(article.publishing.publishedAt),
      updatedAt: trimToUndefined(article.publishing.updatedAt),
      scheduledAt: trimToUndefined(article.publishing.scheduledAt),
      author: trimToUndefined(article.publishing.author),
      featured: article.publishing.featured,
    },
    relationships: omitEmptyObject({
      parentTopic: trimToUndefined(article.relationships?.parentTopic),
      relatedArticles: uniqueStrings(article.relationships?.relatedArticles),
      relatedLinks: article.relationships?.relatedLinks
        ?.map((link) => ({
          title: link.title.trim(),
          href: link.href.trim(),
          description: trimToUndefined(link.description),
        }))
        .filter((link) => link.title && link.href),
    }),
    faq: article.faq
      ?.map((item) => ({
        question: item.question.trim(),
        answer: item.answer.trim(),
      }))
      .filter((item) => item.question || item.answer),
    review: omitEmptyObject({
      ratingCategories: article.review?.ratingCategories
        ?.map((item) => ({
          label: item.label.trim(),
          score: parseOptionalNumber(item.score) ?? item.score,
        }))
        .filter((item) => item.label),
    }),
    comparison: omitEmptyObject({
      winnerId: trimToUndefined(article.comparison?.winnerId),
      winnerReason: trimToUndefined(article.comparison?.winnerReason),
      rows: normalizeComparisonRows(article.comparison?.rows),
    }),
  };
}
