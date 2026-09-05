import { isAmazonSearchUrl } from "@/lib/admin/editorial-signals";
import { classifyAsinStatus, normalizeAsin } from "@/lib/commerce/asin";
import { isCommerceProviderConfigured } from "@/lib/commerce/provider";
import { hasDetailUrlSuggestion } from "@/lib/editorial/commerce-verification";
import { validateProductV1 } from "@/lib/product-schema";
import type { ArticleV1, ArticleV1Type } from "@/types/article-v1";
import type { ProductCategoryV1, ProductV1Document } from "@/types/product-v1";

/** Editorial default — products with lastChecked older than this are stale. */
export const COMMERCE_STALE_DAYS = 90;

/** Published Article refs at or above this count escalate maintenance priority. */
export const HIGH_IMPACT_PUBLISHED_REF_THRESHOLD = 3;

export type ProductMaintenanceReasonType =
  | "missing-asin"
  | "search-url"
  | "availability-unknown"
  | "commerce-never-checked"
  | "commerce-stale"
  | "asin-url-mismatch"
  | "invalid-asin"
  | "placeholder-asin"
  | "missing-primary-image"
  | "missing-review-data"
  | "sparse-product-data"
  | "unreferenced-product"
  | "high-impact-product"
  | "validation-blocker";

export type ProductMaintenancePriority = "high" | "medium" | "low";

export type ProductMaintenanceAction =
  | "edit-product"
  | "view-articles"
  | "review-commerce"
  | "review-editorial";

export type ProductMaintenanceReason = {
  id: string;
  type: ProductMaintenanceReasonType;
  message: string;
  priority: ProductMaintenancePriority;
};

export type ProductArticleRef = {
  id: string;
  title: string;
  slug: string;
  type: ArticleV1Type;
  status: string;
};

export type ProductDependencyProfile = {
  productId: string;
  totalRefs: number;
  publishedRefs: number;
  bestListRefs: number;
  reviewRefs: number;
  comparisonRefs: number;
  articles: ProductArticleRef[];
};

export type ProductMaintenanceEvidence = {
  commerce?: {
    asin?: string;
    amazonUrl?: string;
    availability?: string;
    lastChecked?: string;
    daysSinceChecked?: number;
    detailUrlSuggestionAvailable?: boolean;
    amazonLookupAvailable?: boolean;
    readyForAmazonLookup?: boolean;
    asinStatus?: "valid" | "missing" | "invalid" | "placeholder";
    urlAsin?: string;
  };
  catalog?: {
    hasPrimaryImage: boolean;
    hasGallery: boolean;
    hasRating: boolean;
    hasVerdict: boolean;
  };
  editorial?: {
    hasPros: boolean;
    hasCons: boolean;
    hasDescription: boolean;
  };
  dependencies?: ProductDependencyProfile;
};

export type ProductMaintenanceCandidate = {
  productId: string;
  name: string;
  category: ProductCategoryV1;
  priority: ProductMaintenancePriority;
  reasons: ProductMaintenanceReason[];
  evidence: ProductMaintenanceEvidence;
  suggestedActions: ProductMaintenanceAction[];
};

export type ProductMaintenanceQueue = {
  candidates: ProductMaintenanceCandidate[];
  counts: { high: number; medium: number; low: number; total: number };
};

const PRIORITY_ORDER: Record<ProductMaintenancePriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function maxPriority(a: ProductMaintenancePriority, b: ProductMaintenancePriority): ProductMaintenancePriority {
  return PRIORITY_ORDER[a] <= PRIORITY_ORDER[b] ? a : b;
}

function escalate(priority: ProductMaintenancePriority): ProductMaintenancePriority {
  if (priority === "low") return "medium";
  if (priority === "medium") return "high";
  return "high";
}

export function extractAsinFromAmazonUrl(url: string): string | null {
  const dpMatch = url.match(/\/dp\/([A-Z0-9]{10})(?:[/?]|$)/i);
  if (dpMatch) return dpMatch[1].toUpperCase();
  const gpMatch = url.match(/\/gp\/product\/([A-Z0-9]{10})(?:[/?]|$)/i);
  if (gpMatch) return gpMatch[1].toUpperCase();
  return null;
}

export function daysSince(iso: string, now: Date): number | null {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  return Math.floor((now.getTime() - ts) / (1000 * 60 * 60 * 24));
}

export function buildProductDependencies(
  products: ProductV1Document[],
  articles: ArticleV1[],
): Map<string, ProductDependencyProfile> {
  const map = new Map<string, ProductDependencyProfile>();
  for (const p of products) {
    map.set(p.id, {
      productId: p.id,
      totalRefs: 0,
      publishedRefs: 0,
      bestListRefs: 0,
      reviewRefs: 0,
      comparisonRefs: 0,
      articles: [],
    });
  }

  for (const article of articles) {
    const refs = article.products?.primary ?? [];
    for (const ref of refs) {
      const profile = map.get(ref.productId);
      if (!profile) continue;
      profile.totalRefs += 1;
      if (article.publishing.status === "published") profile.publishedRefs += 1;
      const type = article.classification.type;
      if (type === "best-list") profile.bestListRefs += 1;
      if (type === "review") profile.reviewRefs += 1;
      if (type === "comparison") profile.comparisonRefs += 1;
      profile.articles.push({
        id: article.identity.id,
        title: article.identity.title,
        slug: article.identity.slug,
        type,
        status: article.publishing.status,
      });
    }
  }

  return map;
}

function actionsForReasons(reasons: ProductMaintenanceReason[]): ProductMaintenanceAction[] {
  const actions = new Set<ProductMaintenanceAction>();
  actions.add("edit-product");
  for (const r of reasons) {
    switch (r.type) {
      case "missing-asin":
      case "invalid-asin":
      case "placeholder-asin":
      case "search-url":
      case "availability-unknown":
      case "commerce-never-checked":
      case "commerce-stale":
      case "asin-url-mismatch":
        actions.add("review-commerce");
        break;
      case "missing-review-data":
      case "sparse-product-data":
        actions.add("review-editorial");
        break;
      case "unreferenced-product":
      case "high-impact-product":
      case "validation-blocker":
        break;
    }
  }
  if (reasons.some((r) => r.type === "high-impact-product" || r.type !== "unreferenced-product")) {
    actions.add("view-articles");
  }
  return [...actions];
}

export function productHasDetailUrlSuggestion(product: ProductV1Document): boolean {
  return hasDetailUrlSuggestion(product.commerce?.asin, product.commerce?.amazonUrl);
}

export function productHasSearchUrlWithAsin(product: ProductV1Document): boolean {
  return productHasDetailUrlSuggestion(product);
}

export function evaluateProductMaintenanceForProduct(
  product: ProductV1Document,
  deps: ProductDependencyProfile,
  options?: { now?: Date; staleDays?: number },
): ProductMaintenanceCandidate | undefined {
  return buildSingleProductMaintenanceCandidate(product, deps, {
    now: options?.now ?? new Date(),
    staleDays: options?.staleDays ?? COMMERCE_STALE_DAYS,
  });
}

export function buildProductMaintenanceQueue(input: {
  products: ProductV1Document[];
  articles: ArticleV1[];
  now?: Date;
  staleDays?: number;
}): ProductMaintenanceQueue {
  const now = input.now ?? new Date();
  const staleDays = input.staleDays ?? COMMERCE_STALE_DAYS;
  const dependencies = buildProductDependencies(input.products, input.articles);
  const candidates: ProductMaintenanceCandidate[] = [];

  for (const product of input.products) {
    const candidate = buildSingleProductMaintenanceCandidate(product, dependencies.get(product.id)!, {
      now,
      staleDays,
    });
    if (candidate) candidates.push(candidate);
  }

  candidates.sort((a, b) => {
    const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pd !== 0) return pd;
    const refsA = a.evidence.dependencies?.publishedRefs ?? 0;
    const refsB = b.evidence.dependencies?.publishedRefs ?? 0;
    if (refsB !== refsA) return refsB - refsA;
    return a.name.localeCompare(b.name);
  });

  return {
    candidates,
    counts: {
      high: candidates.filter((c) => c.priority === "high").length,
      medium: candidates.filter((c) => c.priority === "medium").length,
      low: candidates.filter((c) => c.priority === "low").length,
      total: candidates.length,
    },
  };
}

function buildSingleProductMaintenanceCandidate(
  product: ProductV1Document,
  deps: ProductDependencyProfile,
  options: { now: Date; staleDays: number },
): ProductMaintenanceCandidate | undefined {
    const reasons: ProductMaintenanceReason[] = [];
    const commerce = product.commerce ?? {};
    const { now, staleDays } = options;

    const asinStatus = classifyAsinStatus(commerce.asin);

    const evidence: ProductMaintenanceEvidence = {
      commerce: {
        asin: commerce.asin,
        amazonUrl: commerce.amazonUrl,
        availability: commerce.availability,
        lastChecked: commerce.lastChecked,
        detailUrlSuggestionAvailable: hasDetailUrlSuggestion(commerce.asin, commerce.amazonUrl),
        amazonLookupAvailable: isCommerceProviderConfigured() && asinStatus === "valid",
        readyForAmazonLookup:
          isCommerceProviderConfigured() &&
          (asinStatus === "valid" || asinStatus === "missing" || asinStatus === "invalid"),
        asinStatus,
      },
      catalog: {
        hasPrimaryImage: Boolean(product.media?.primary?.trim()),
        hasGallery: (product.media?.gallery?.length ?? 0) > 0,
        hasRating: typeof product.review?.rating === "number",
        hasVerdict: Boolean(product.editorial?.verdict?.trim()),
      },
      editorial: {
        hasPros: (product.editorial?.pros?.length ?? 0) > 0,
        hasCons: (product.editorial?.cons?.length ?? 0) > 0,
        hasDescription: Boolean(product.editorial?.description?.trim()),
      },
      dependencies: deps,
    };

    const validation = validateProductV1(product);
    for (const error of validation.errors) {
      reasons.push({
        id: "validation.blocker",
        type: "validation-blocker",
        priority: "high",
        message: error,
      });
    }

    if (asinStatus === "missing") {
      reasons.push({
        id: "commerce.missing-asin",
        type: "missing-asin",
        priority: "low",
        message: "ASIN is missing — search URL fallback may be intentional.",
      });
    } else if (asinStatus === "placeholder") {
      reasons.push({
        id: "commerce.placeholder-asin",
        type: "placeholder-asin",
        priority: "high",
        message: "ASIN is a development placeholder — remove or replace with a verified real ASIN.",
      });
    } else if (asinStatus === "invalid") {
      const invalid = normalizeAsin(commerce.asin);
      reasons.push({
        id: "commerce.invalid-asin",
        type: "invalid-asin",
        priority: "medium",
        message: invalid.ok ? "ASIN appears invalid." : invalid.message,
      });
    }

    if (isAmazonSearchUrl(commerce.amazonUrl)) {
      reasons.push({
        id: "commerce.search-url",
        type: "search-url",
        priority: "medium",
        message: "Amazon URL is a search URL, not a product detail page.",
      });
    }

    if (commerce.availability === "unknown") {
      reasons.push({
        id: "commerce.availability-unknown",
        type: "availability-unknown",
        priority: deps.publishedRefs >= HIGH_IMPACT_PUBLISHED_REF_THRESHOLD ? "medium" : "low",
        message: "Availability is unknown.",
      });
    }

    const hasCommerceData = Boolean(commerce.amazonUrl?.trim() || commerce.asin?.trim());
    if (hasCommerceData && !commerce.lastChecked?.trim()) {
      reasons.push({
        id: "commerce.never-checked",
        type: "commerce-never-checked",
        priority: "medium",
        message: "Commerce data exists but lastChecked is not set.",
      });
    }

    if (commerce.lastChecked?.trim()) {
      const days = daysSince(commerce.lastChecked, now);
      if (days !== null) {
        evidence.commerce!.daysSinceChecked = days;
        if (days > staleDays) {
          reasons.push({
            id: "commerce.stale",
            type: "commerce-stale",
            priority: deps.publishedRefs >= HIGH_IMPACT_PUBLISHED_REF_THRESHOLD ? "medium" : "low",
            message: `Commerce last checked ${days} days ago (threshold: ${staleDays} days).`,
          });
        }
      }
    }

    const urlAsin =
      commerce.amazonUrl?.trim() && !isAmazonSearchUrl(commerce.amazonUrl)
        ? extractAsinFromAmazonUrl(commerce.amazonUrl)
        : null;
    if (urlAsin) evidence.commerce!.urlAsin = urlAsin;

    if (commerce.asin?.trim() && commerce.amazonUrl?.trim() && !isAmazonSearchUrl(commerce.amazonUrl)) {
      if (urlAsin && urlAsin !== commerce.asin.trim().toUpperCase()) {
        reasons.push({
          id: "commerce.asin-url-mismatch",
          type: "asin-url-mismatch",
          priority: "high",
          message: `ASIN "${commerce.asin}" does not match URL ASIN "${urlAsin}".`,
        });
      }
    }

    if (commerce.asin?.trim() && isAmazonSearchUrl(commerce.amazonUrl)) {
      reasons.push({
        id: "commerce.asin-with-search-url",
        type: "search-url",
        priority: "medium",
        message: "ASIN is set but Amazon URL is still a search URL — consider upgrading to detail URL.",
      });
    }

    if (!product.media?.primary?.trim()) {
      reasons.push({
        id: "catalog.missing-primary-image",
        type: "missing-primary-image",
        priority: "low",
        message: "Primary image is missing.",
      });
    }

    if (deps.reviewRefs > 0 && typeof product.review?.rating !== "number") {
      reasons.push({
        id: "catalog.missing-review-data",
        type: "missing-review-data",
        priority: "medium",
        message: "Referenced by Review Articles but review.rating is missing.",
      });
    }

    const sparseFields = [
      !product.editorial?.description?.trim(),
      !product.editorial?.verdict?.trim(),
      (product.editorial?.pros?.length ?? 0) === 0,
      (product.editorial?.cons?.length ?? 0) === 0,
      typeof product.review?.rating !== "number",
    ].filter(Boolean).length;

    if (sparseFields >= 3) {
      reasons.push({
        id: "catalog.sparse",
        type: "sparse-product-data",
        priority: "low",
        message: "Product has sparse editorial/catalog data (multiple optional fields empty).",
      });
    }

    if (deps.totalRefs === 0) {
      reasons.push({
        id: "dependencies.unreferenced",
        type: "unreferenced-product",
        priority: "low",
        message: "Not referenced by any Article.",
      });
    }

    if (reasons.length === 0) return undefined;

    let priority: ProductMaintenancePriority = "low";
    for (const r of reasons) {
      priority = maxPriority(priority, r.priority);
    }

    if (deps.publishedRefs >= HIGH_IMPACT_PUBLISHED_REF_THRESHOLD && reasons.some((r) => r.type !== "unreferenced-product" && r.type !== "high-impact-product")) {
      reasons.push({
        id: "dependencies.high-impact",
        type: "high-impact-product",
        priority: "low",
        message: `Referenced by ${deps.publishedRefs} published Articles — changes affect live content.`,
      });
      priority = escalate(priority);
    }

    return {
      productId: product.id,
      name: product.identity.name,
      category: product.identity.category,
      priority,
      reasons,
      evidence,
      suggestedActions: actionsForReasons(reasons),
    };
}

export function getProductMaintenanceCandidate(
  productId: string,
  queue: ProductMaintenanceQueue,
): ProductMaintenanceCandidate | undefined {
  return queue.candidates.find((c) => c.productId === productId);
}
