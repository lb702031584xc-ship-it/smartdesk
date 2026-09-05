import { ARTICLE_RATING_SCALE, PRODUCT_RATING_SCALE } from "./editor-constants";
import { classifyAsinStatus } from "@/lib/commerce/asin";
import { isAmazonSearchUrl } from "./editorial-signals";import { validateArticleIdFormat, validateArticleSlugFormat } from "./article-id";
import { validateProductIdFormat } from "./product-id";
import type { ArticleV1 } from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";

export type LocalHintResult = {
  errors: string[];
  warnings: string[];
};

export function productLocalHints(
  product: ProductV1Document,
  options?: { mode?: "create" | "edit"; existingIds?: Iterable<string> },
): LocalHintResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rating = product.review?.rating;
  if (typeof rating === "number" && (rating < PRODUCT_RATING_SCALE.min || rating > PRODUCT_RATING_SCALE.max)) {
    errors.push(`review.rating must be between ${PRODUCT_RATING_SCALE.min} and ${PRODUCT_RATING_SCALE.max}.`);
  }
  if (isAmazonSearchUrl(product.commerce?.amazonUrl)) {
    warnings.push("Product uses an Amazon search URL.");
  }
  const asinStatus = classifyAsinStatus(product.commerce?.asin);
  if (asinStatus === "placeholder") {
    errors.push(
      "commerce.asin is a development placeholder. Remove it or enter a verified real ASIN.",
    );
  } else if (asinStatus === "invalid") {
    errors.push("commerce.asin is not a valid 10-character Amazon identifier.");
  } else if (asinStatus === "missing") {
    warnings.push("ASIN is missing.");
  }  if (options?.mode === "create") {
    const idError = validateProductIdFormat(product.id ?? "");
    if (idError) errors.push(idError);
    if (product.id && options.existingIds && new Set(options.existingIds).has(product.id)) {
      errors.push("A product with this ID already exists.");
    }
    if (!product.media?.gallery?.length) {
      warnings.push("Gallery is empty.");
    }
    if (product.commerce?.availability === "unknown") {
      warnings.push("Availability is unknown.");
    }
    if (product.editorial?.featured) {
      warnings.push("Product is Featured.");
    }
  }
  return { errors, warnings };
}

export function articleLocalHints(
  article: ArticleV1,
  options?: {
    mode?: "create" | "edit";
    existingIds?: Iterable<string>;
    existingSlugs?: Iterable<string>;
    body?: string;
  },
): LocalHintResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const primary = article.products?.primary ?? [];
  const ranks = primary
    .map((ref) => ref.rank)
    .filter((rank): rank is number => typeof rank === "number");
  const seen = new Set<number>();
  for (const rank of ranks) {
    if (seen.has(rank)) errors.push(`Duplicate product rank: ${rank}.`);
    seen.add(rank);
  }

  const winner = article.comparison?.winnerId;
  if (winner && !primary.some((ref) => ref.productId === winner)) {
    errors.push("Comparison winner must be one of the selected products.");
  }

  (article.faq ?? []).forEach((item, index) => {
    if (!item.question.trim() && item.answer.trim()) {
      errors.push(`FAQ ${index + 1} is missing a question.`);
    }
  });

  (article.review?.ratingCategories ?? []).forEach((item, index) => {
    if (
      typeof item.score === "number" &&
      (item.score < ARTICLE_RATING_SCALE.min || item.score > ARTICLE_RATING_SCALE.max)
    ) {
      errors.push(
        `review.ratingCategories[${index}].score must be between ${ARTICLE_RATING_SCALE.min} and ${ARTICLE_RATING_SCALE.max}.`,
      );
    }
  });

  if (
    options?.mode !== "create" &&
    typeof options?.body === "string" &&
    (article.publishing?.status === "published" || article.publishing?.status === "scheduled") &&
    !options.body.trim()
  ) {
    errors.push(
      article.publishing.status === "scheduled"
        ? "Scheduled articles must have a Markdown body before scheduling."
        : "Published articles must have a Markdown body.",
    );
  }

  if (
    options?.mode !== "create" &&
    article.publishing?.status === "scheduled"
  ) {
    if (!article.publishing.scheduledAt) {
      errors.push("Scheduled articles require a future publish time.");
    } else {
      const scheduledMs = new Date(article.publishing.scheduledAt).getTime();
      if (Number.isNaN(scheduledMs)) {
        errors.push("Scheduled publish time is not a valid date.");
      } else if (scheduledMs <= Date.now()) {
        errors.push("Scheduled publish time must be in the future. Select 'published' for immediate publication.");
      }
    }
  }

  if (options?.mode === "create") {
    const idError = validateArticleIdFormat(article.identity?.id ?? "");
    if (idError) errors.push(idError);
    const slugError = validateArticleSlugFormat(article.identity?.slug ?? "");
    if (slugError) errors.push(slugError);
    if (!article.classification?.type) {
      errors.push("Article type is required.");
    }
    if (!article.editorial?.intent) {
      errors.push("editorial.intent is required.");
    }
    if (article.publishing?.status !== "draft") {
      errors.push("New articles must be created as draft.");
    }
    if (
      article.identity?.id &&
      options.existingIds &&
      new Set(options.existingIds).has(article.identity.id)
    ) {
      errors.push("An article with this ID already exists.");
    }
    if (
      article.identity?.slug &&
      options.existingSlugs &&
      new Set(options.existingSlugs).has(article.identity.slug)
    ) {
      errors.push("An article with this slug already exists.");
    }
    if (article.publishing?.featured) {
      warnings.push("Article is Featured.");
    }
  }

  return { errors, warnings };
}
