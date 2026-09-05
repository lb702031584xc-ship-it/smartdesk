import type {
  ArticleMeta,
  ArticleType,
  ComparisonRow,
  FaqItem,
  InternalLink,
  RatingCategory,
} from "@/types/article";
import type {
  ArticleComparisonRowV1,
  ArticleFaqItemV1,
  ArticleProductReferenceV1,
  ArticleRatingCategoryV1,
  ArticleSearchIntent,
  ArticleV1,
  ArticleV1Type,
  ArticleV1ValidationResult,
  ArticlePublishingStatus,
} from "@/types/article-v1";
import type { ProductRef } from "@/types/product";

const ARTICLE_V1_TYPES: readonly ArticleV1Type[] = [
  "best-list",
  "review",
  "comparison",
  "guide",
  "how-to",
  "informational",
];

const SEARCH_INTENTS: readonly ArticleSearchIntent[] = [
  "informational",
  "commercial",
  "transactional",
  "mixed",
];

const PUBLISHING_STATUSES: readonly ArticlePublishingStatus[] = [
  "draft",
  "review",
  "scheduled",
  "published",
  "archived",
];

/** Matches RatingBox / Product.rating scale. */
export const ARTICLE_RATING_SCALE = { min: 0, max: 5 } as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isArticleV1Type(value: unknown): value is ArticleV1Type {
  return typeof value === "string" && ARTICLE_V1_TYPES.includes(value as ArticleV1Type);
}

function isSearchIntent(value: unknown): value is ArticleSearchIntent {
  return typeof value === "string" && SEARCH_INTENTS.includes(value as ArticleSearchIntent);
}

function isPublishingStatus(value: unknown): value is ArticlePublishingStatus {
  return (
    typeof value === "string" &&
    PUBLISHING_STATUSES.includes(value as ArticlePublishingStatus)
  );
}

function getPrimaryRefs(article: ArticleV1): ArticleProductReferenceV1[] {
  return article.products?.primary ?? [];
}

function validateFaqItems(
  faq: unknown,
  errors: string[],
  warnings: string[],
): void {
  if (faq === undefined) return;
  if (!Array.isArray(faq)) {
    errors.push("faq must be an array when present.");
    return;
  }

  const questions = new Set<string>();
  faq.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`faq[${index}] must be an object.`);
      return;
    }
    if (!isNonEmptyString(item.question)) {
      errors.push(`faq[${index}].question is required.`);
    } else {
      const key = item.question.trim().toLowerCase();
      if (questions.has(key)) {
        warnings.push(`Duplicate FAQ question: "${item.question.trim()}".`);
      }
      questions.add(key);
    }
    if (!isNonEmptyString(item.answer)) {
      errors.push(`faq[${index}].answer is required.`);
    }
  });
}

function validateRatingCategories(
  categories: unknown,
  errors: string[],
  warnings: string[],
): void {
  if (categories === undefined) return;
  if (!Array.isArray(categories)) {
    errors.push("review.ratingCategories must be an array when present.");
    return;
  }

  const labels = new Set<string>();
  categories.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`review.ratingCategories[${index}] must be an object.`);
      return;
    }
    if (!isNonEmptyString(entry.label)) {
      errors.push(`review.ratingCategories[${index}].label is required.`);
    } else {
      const key = entry.label.trim().toLowerCase();
      if (labels.has(key)) {
        warnings.push(
          `Duplicate rating category label: "${entry.label.trim()}".`,
        );
      }
      labels.add(key);
    }
    if (typeof entry.score !== "number" || !Number.isFinite(entry.score)) {
      errors.push(`review.ratingCategories[${index}].score must be a number.`);
    } else if (
      entry.score < ARTICLE_RATING_SCALE.min ||
      entry.score > ARTICLE_RATING_SCALE.max
    ) {
      errors.push(
        `review.ratingCategories[${index}].score must be between ${ARTICLE_RATING_SCALE.min} and ${ARTICLE_RATING_SCALE.max}.`,
      );
    }
  });
}

function validateComparisonRows(
  rows: unknown,
  productIds: string[],
  errors: string[],
  warnings: string[],
): void {
  if (rows === undefined) return;
  if (!Array.isArray(rows)) {
    errors.push("comparison.rows must be an array when present.");
    return;
  }

  rows.forEach((row, index) => {
    if (!isRecord(row)) {
      errors.push(`comparison.rows[${index}] must be an object.`);
      return;
    }
    if (!isNonEmptyString(row.label)) {
      errors.push(`comparison.rows[${index}].label is required.`);
    }
    if (row.source !== "editorial" && row.source !== "spec") {
      errors.push(
        `comparison.rows[${index}].source must be "editorial" or "spec".`,
      );
      return;
    }
    if (row.source === "spec") {
      if (!isNonEmptyString(row.specPath)) {
        errors.push(
          `comparison.rows[${index}].specPath is required when source is "spec".`,
        );
      }
      if (row.values === undefined) {
        warnings.push(
          `comparison.rows[${index}] source "spec" has no values; Product-spec resolution is not implemented yet.`,
        );
      }
    }
    if (row.values !== undefined) {
      if (!isRecord(row.values)) {
        errors.push(
          `comparison.rows[${index}].values must be an object keyed by productId.`,
        );
      } else if (productIds.length > 0) {
        for (const productId of productIds) {
          if (!(productId in row.values)) {
            warnings.push(
              `comparison.rows[${index}] missing value for product "${productId}".`,
            );
          }
        }
      }
    } else if (row.source === "editorial") {
      errors.push(
        `comparison.rows[${index}].values is required when source is "editorial".`,
      );
    }
  });
}

/**
 * Structural validation only. Does not look up products on disk.
 */
export function validateArticleV1(article: unknown): ArticleV1ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(article)) {
    return { valid: false, errors: ["Article V1 must be an object."], warnings };
  }

  const identity = article.identity;
  if (!isRecord(identity)) {
    errors.push("identity is required.");
  } else {
    if (!isNonEmptyString(identity.id)) errors.push("identity.id is required.");
    if (!isNonEmptyString(identity.title)) errors.push("identity.title is required.");
    if (!isNonEmptyString(identity.slug)) errors.push("identity.slug is required.");
  }

  const classification = article.classification;
  if (!isRecord(classification)) {
    errors.push("classification is required.");
  } else if (!isArticleV1Type(classification.type)) {
    errors.push(
      `classification.type must be one of: ${ARTICLE_V1_TYPES.join(", ")}.`,
    );
  }

  const editorial = article.editorial;
  if (!isRecord(editorial)) {
    errors.push("editorial is required.");
  } else {
    if (!isSearchIntent(editorial.intent)) {
      errors.push(`editorial.intent must be one of: ${SEARCH_INTENTS.join(", ")}.`);
    }
    if (
      editorial.methodology !== undefined &&
      typeof editorial.methodology !== "string"
    ) {
      errors.push("editorial.methodology must be a string when present.");
    }
  }

  const publishing = article.publishing;
  if (!isRecord(publishing)) {
    errors.push("publishing is required.");
  } else {
    if (!isPublishingStatus(publishing.status)) {
      errors.push(
        `publishing.status must be one of: ${PUBLISHING_STATUSES.join(", ")}.`,
      );
    }
    if (
      publishing.featured !== undefined &&
      typeof publishing.featured !== "boolean"
    ) {
      errors.push("publishing.featured must be a boolean when present.");
    }
    if (
      publishing.scheduledAt !== undefined &&
      typeof publishing.scheduledAt !== "string"
    ) {
      errors.push("publishing.scheduledAt must be a string when present.");
    }
  }

  const seo = article.seo;
  if (seo !== undefined) {
    if (!isRecord(seo)) {
      errors.push("seo must be an object when present.");
    } else {
      if (seo.metaTitle !== undefined && typeof seo.metaTitle !== "string") {
        errors.push("seo.metaTitle must be a string when present.");
      }
      if (
        seo.metaDescription !== undefined &&
        typeof seo.metaDescription !== "string"
      ) {
        errors.push("seo.metaDescription must be a string when present.");
      }
      if (seo.canonical !== undefined && typeof seo.canonical !== "string") {
        errors.push("seo.canonical must be a string when present.");
      }
      if (seo.noindex !== undefined && typeof seo.noindex !== "boolean") {
        errors.push("seo.noindex must be a boolean when present.");
      }
    }
  }

  const products = article.products;
  const primaryIds: string[] = [];
  if (products !== undefined && !isRecord(products)) {
    errors.push("products must be an object when present.");
  } else if (isRecord(products) && products.primary !== undefined) {
    if (!Array.isArray(products.primary)) {
      errors.push("products.primary must be an array.");
    } else {
      const ranks: number[] = [];

      products.primary.forEach((entry, index) => {
        if (!isRecord(entry)) {
          errors.push(`products.primary[${index}] must be an object.`);
          return;
        }

        if (!isNonEmptyString(entry.productId)) {
          errors.push(`products.primary[${index}].productId is required.`);
        } else {
          primaryIds.push(entry.productId);
        }

        if (entry.rank !== undefined) {
          if (typeof entry.rank !== "number" || !Number.isFinite(entry.rank)) {
            errors.push(`products.primary[${index}].rank must be a number.`);
          } else {
            ranks.push(entry.rank);
          }
        }

        // Catalog fields belong on ProductV1 — reject duplication on Article refs.
        const forbiddenCatalogKeys = [
          "name",
          "productName",
          "brand",
          "image",
          "images",
          "price",
          "priceRange",
          "amazonUrl",
          "asin",
          "specs",
          "rating",
          "pros",
          "cons",
          "availability",
        ] as const;
        for (const key of forbiddenCatalogKeys) {
          if (key in entry) {
            errors.push(
              `products.primary[${index}].${key} is not allowed; resolve from ProductV1.`,
            );
          }
        }
      });

      const seenIds = new Set<string>();
      for (const id of primaryIds) {
        if (seenIds.has(id)) {
          errors.push(`Duplicate productId in products.primary: "${id}".`);
        }
        seenIds.add(id);
      }

      const seenRanks = new Set<number>();
      for (const rank of ranks) {
        if (seenRanks.has(rank)) {
          errors.push(`Duplicate rank in products.primary: ${rank}.`);
        }
        seenRanks.add(rank);
      }
    }
  }

  validateFaqItems(article.faq, errors, warnings);

  const review = article.review;
  if (review !== undefined) {
    if (!isRecord(review)) {
      errors.push("review must be an object when present.");
    } else {
      validateRatingCategories(review.ratingCategories, errors, warnings);
    }
  }

  const comparison = article.comparison;
  if (comparison !== undefined) {
    if (!isRecord(comparison)) {
      errors.push("comparison must be an object when present.");
    } else {
      if (
        comparison.winnerId !== undefined &&
        typeof comparison.winnerId !== "string"
      ) {
        errors.push("comparison.winnerId must be a string when present.");
      }
      if (
        comparison.winnerReason !== undefined &&
        typeof comparison.winnerReason !== "string"
      ) {
        errors.push("comparison.winnerReason must be a string when present.");
      }
      validateComparisonRows(comparison.rows, primaryIds, errors, warnings);
    }
  }

  const relationships = article.relationships;
  if (relationships !== undefined) {
    if (!isRecord(relationships)) {
      errors.push("relationships must be an object when present.");
    } else if (relationships.relatedLinks !== undefined) {
      if (!Array.isArray(relationships.relatedLinks)) {
        errors.push("relationships.relatedLinks must be an array when present.");
      } else {
        relationships.relatedLinks.forEach((link, index) => {
          if (!isRecord(link)) {
            errors.push(`relationships.relatedLinks[${index}] must be an object.`);
            return;
          }
          if (!isNonEmptyString(link.title)) {
            errors.push(`relationships.relatedLinks[${index}].title is required.`);
          }
          if (!isNonEmptyString(link.href)) {
            errors.push(`relationships.relatedLinks[${index}].href is required.`);
          }
        });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function resolveWinnerId(article: ArticleV1): string | undefined {
  const fromComparison = article.comparison?.winnerId?.trim();
  if (fromComparison) return fromComparison;
  return article.products?.winnerProductId?.trim() || undefined;
}

function resolveWinnerReason(article: ArticleV1): string | undefined {
  const fromComparison = article.comparison?.winnerReason?.trim();
  if (fromComparison) return fromComparison;
  return article.products?.winnerReason?.trim() || undefined;
}

/**
 * Template-aware checks for Best List / Review / Comparison.
 * Call after structural validateArticleV1().
 */
export function validateArticleV1TemplateRules(
  article: ArticleV1,
): ArticleV1ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const primary = getPrimaryRefs(article);
  const type = article.classification.type;

  if (type === "best-list" && primary.length < 1) {
    errors.push("best-list articles require at least one products.primary entry.");
  }

  if (type === "review") {
    if (primary.length !== 1) {
      errors.push(
        "review articles require exactly one products.primary entry (SmartDesk review template).",
      );
    }
  }

  if (type === "comparison" && primary.length < 2) {
    errors.push("comparison articles require at least two products.primary entries.");
  }

  if (type === "best-list") {
    const ranks = primary
      .map((ref) => ref.rank)
      .filter((rank): rank is number => typeof rank === "number");
    const seenRanks = new Set<number>();
    for (const rank of ranks) {
      if (seenRanks.has(rank)) {
        errors.push(`best-list duplicate rank: ${rank}.`);
      }
      seenRanks.add(rank);
    }
  }

  const winnerId = resolveWinnerId(article);
  if (winnerId) {
    if (!primary.some((ref) => ref.productId === winnerId)) {
      errors.push(
        `winnerId "${winnerId}" is not present in products.primary.`,
      );
    }
  }

  if (type === "comparison" && primary.length >= 2 && !winnerId) {
    const hasRankOne = primary.some((ref) => ref.rank === 1);
    if (!hasRankOne) {
      warnings.push(
        "comparison has no winnerId and no rank:1; adapter will use the first product.",
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Optional repository check.
 * Fixture / draft: missing products are warnings.
 * Published production articles: missing products are errors.
 */
export function validateArticleV1ProductRefs(
  article: ArticleV1,
  lookup: (productId: string) => boolean,
  options?: { missingProductSeverity?: "warning" | "error" },
): ArticleV1ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const severity = options?.missingProductSeverity ?? "warning";

  for (const ref of getPrimaryRefs(article)) {
    if (!lookup(ref.productId)) {
      const message = `Referenced product not found: "${ref.productId}".`;
      if (severity === "error") errors.push(message);
      else warnings.push(message);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function isArticleV1(value: unknown): value is ArticleV1 {
  if (!validateArticleV1(value).valid) return false;
  return validateArticleV1TemplateRules(value as ArticleV1).valid;
}

function mapV1TypeToLegacy(type: ArticleV1Type): ArticleType {
  if (type === "best-list") return "best";
  if (type === "review") return "review";
  if (type === "comparison") return "comparison";
  return "guide";
}

function mapLegacyTypeToV1(type: ArticleType | "ranking"): ArticleV1Type {
  if (type === "best" || type === "ranking") return "best-list";
  if (type === "review") return "review";
  if (type === "comparison") return "comparison";
  return "guide";
}

function defaultIntentForLegacy(type: ArticleType): ArticleSearchIntent {
  if (type === "guide") return "informational";
  return "commercial";
}

const ROLE_BADGES: Record<string, string> = {
  "best-overall": "Best Overall",
  "best-budget": "Best Budget",
  "best-value": "Best Value",
  "best-premium": "Best Premium",
  "best-space-saving": "Best Space Saving",
  "best-for-beginners": "Best for Beginners",
};

export function roleToLegacyBadge(role?: string): string | undefined {
  if (!role) return undefined;
  return ROLE_BADGES[role] ?? role;
}

export function isPublishedArticleV1(article: ArticleV1): boolean {
  return article.publishing.status === "published";
}

function productRefsFromV1(article: ArticleV1): ProductRef[] {
  return getPrimaryRefs(article).map((ref) => ({
    id: ref.productId,
    rank: ref.rank,
    badge: roleToLegacyBadge(ref.role),
    summary: ref.summary,
    verdict: ref.verdict,
    bestFor: ref.bestFor,
  }));
}

function faqFromV1(article: ArticleV1): FaqItem[] {
  return (article.faq ?? []).map((item) => ({
    question: item.question.trim(),
    answer: item.answer.trim(),
  }));
}

function ratingCategoriesFromV1(article: ArticleV1): RatingCategory[] {
  return (article.review?.ratingCategories ?? []).map((item) => ({
    label: item.label.trim(),
    score: item.score,
  }));
}

function comparisonRowsFromV1(article: ArticleV1): ComparisonRow[] {
  const productIds = getPrimaryRefs(article).map((ref) => ref.productId);
  const rows = article.comparison?.rows ?? [];

  return rows.map((row) => {
    const valuesById = row.values ?? {};
    return {
      feature: row.label.trim(),
      values: productIds.map((productId) => {
        const value = valuesById[productId];
        return typeof value === "string" ? value : "";
      }),
    };
  });
}

function relatedFromV1(article: ArticleV1): InternalLink[] {
  return (article.relationships?.relatedLinks ?? []).map((link) => ({
    title: link.title.trim(),
    href: link.href.trim(),
    description: link.description?.trim() || undefined,
  }));
}

/**
 * ArticleV1 → legacy ArticleMeta (production rendering contract).
 *
 * Still unused at runtime:
 * - commerce (affiliate still uses Product.amazonUrl + AffiliateButton)
 * - relationships.relatedArticles (ID graph; use relatedLinks for templates)
 * - seo.primaryKeyword / secondaryKeywords (planning data only)
 * - comparison.rows source "spec" resolution (values fallback only)
 *
 * Wired rich fields:
 * - faq → faq / faqs (+ JSON-LD FAQPage via buildArticleJsonLd)
 * - review.ratingCategories → ratingCategories
 * - comparison.rows → comparisonRows
 * - comparison.winnerId | products.winnerProductId → winnerId
 */
export function articleV1ToLegacyMeta(article: ArticleV1): ArticleMeta {
  const type = mapV1TypeToLegacy(article.classification.type);
  const productRefs = productRefsFromV1(article);
  const description =
    article.seo?.metaDescription?.trim() ||
    article.editorial.summary ||
    "";
  const date =
    article.publishing.publishedAt || article.publishing.updatedAt || "";
  const explicitWinner = resolveWinnerId(article);
  const winner =
    (explicitWinner
      ? productRefs.find((ref) => ref.id === explicitWinner)
      : undefined) ??
    productRefs.find((ref) => ref.rank === 1) ??
    productRefs[0];
  const seoTitle = article.seo?.metaTitle?.trim() || undefined;
  const seoCanonical = article.seo?.canonical?.trim() || undefined;
  const faq = faqFromV1(article);

  return {
    title: article.identity.title,
    description,
    date,
    updated: article.publishing.updatedAt,
    category: article.classification.category || "",
    coverImage: article.media?.featuredImage || undefined,
    featured: article.publishing.featured === true,
    tags: article.classification.tags ?? [],
    author: article.publishing.author,
    intro: article.editorial.summary,
    methodology: article.editorial.methodology?.trim() || undefined,
    winnerId: winner?.id,
    winnerReason: resolveWinnerReason(article),
    productId: type === "review" ? productRefs[0]?.id : undefined,
    slug: article.identity.slug,
    type,
    template: type,
    readingTime: "",
    productIds: productRefs.map((ref) => ref.id),
    productRefs,
    faq,
    faqs: faq,
    ratingCategories: ratingCategoriesFromV1(article),
    comparisonRows: comparisonRowsFromV1(article),
    related: relatedFromV1(article),
    seoTitle,
    seoCanonical,
    noindex:
      typeof article.seo?.noindex === "boolean" ? article.seo.noindex : undefined,
  };
}

/**
 * Best-effort ArticleMeta → ArticleV1 for migration/history tooling.
 * Not used by the production article loader after Phase 8.
 */
export function legacyArticleToV1(meta: ArticleMeta): ArticleV1 {
  const primary: ArticleProductReferenceV1[] = meta.productRefs.map((ref) => ({
    productId: ref.id,
    rank: ref.rank,
    role: ref.badge,
    summary: ref.summary,
    verdict: ref.verdict,
    bestFor: ref.bestFor,
  }));

  const faq: ArticleFaqItemV1[] = (meta.faq ?? []).map((item) => ({
    question: item.question,
    answer: item.answer,
  }));

  const ratingCategories: ArticleRatingCategoryV1[] = (
    meta.ratingCategories ?? []
  ).map((item) => ({
    label: item.label,
    score: item.score,
  }));

  const comparisonRows: ArticleComparisonRowV1[] = (
    meta.comparisonRows ?? []
  ).map((row) => {
    const values: Record<string, string> = {};
    primary.forEach((ref, index) => {
      values[ref.productId] = row.values[index] ?? "";
    });
    return {
      label: row.feature,
      source: "editorial",
      values,
    };
  });

  return {
    identity: {
      id: meta.slug,
      title: meta.title,
      slug: meta.slug,
    },
    classification: {
      type: mapLegacyTypeToV1(meta.type),
      category: meta.category,
      tags: meta.tags ?? [],
    },
    editorial: {
      summary: meta.intro || meta.description,
      intent: defaultIntentForLegacy(meta.type),
      methodology: meta.methodology,
    },
    seo: {
      metaTitle: meta.title,
      metaDescription: meta.description,
      secondaryKeywords: meta.tags ?? [],
      canonical: "",
      noindex: false,
    },
    products: {
      primary,
      winnerProductId: meta.winnerId,
      winnerReason: meta.winnerReason,
    },
    commerce: {
      affiliateEnabled: true,
      disclosure: true,
      ctaStyle: "amazon",
    },
    media: {
      featuredImage: meta.coverImage || "",
    },
    publishing: {
      status: "published",
      publishedAt: meta.date,
      updatedAt: meta.updated,
      author: meta.author,
      featured: meta.featured,
    },
    relationships: {
      relatedArticles: [],
      relatedLinks: (meta.related ?? []).map((link) => ({
        title: link.title,
        href: link.href,
        description: link.description,
      })),
    },
    faq: faq.length > 0 ? faq : undefined,
    review:
      ratingCategories.length > 0 ? { ratingCategories } : undefined,
    comparison:
      meta.type === "comparison" || comparisonRows.length > 0
        ? {
            winnerId: meta.winnerId,
            winnerReason: meta.winnerReason,
            rows: comparisonRows.length > 0 ? comparisonRows : undefined,
          }
        : undefined,
  };
}

/** @deprecated Alias kept for the Phase 2 naming variants in the spec. */
export const legacyMetaToArticleV1 = legacyArticleToV1;
