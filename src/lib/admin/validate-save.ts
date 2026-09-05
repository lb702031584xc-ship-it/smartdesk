import {
  validateArticleV1,
  validateArticleV1ProductRefs,
  validateArticleV1TemplateRules,
  isPublishedArticleV1,
} from "@/lib/article-schema";
import { validateProductV1 } from "@/lib/product-schema";
import { validateAsinForProductSave } from "@/lib/commerce/asin";
import { articleMarkdownExists } from "@/lib/content/article-markdown";
import { listProductV1Ids } from "@/lib/content/products";
import type { ArticleV1 } from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";
import type { AdminSaveResult } from "./types";
import { validateArticleIdFormat, validateArticleSlugFormat } from "./article-id";
import { validateProductIdFormat } from "./product-id";

function result(
  errors: string[],
  warnings: string[],
  extra?: Partial<AdminSaveResult>,
): AdminSaveResult {
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    ...extra,
  };
}

export function validateAdminProductSave(
  product: unknown,
  options?: { existingId?: string },
): AdminSaveResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const structural = validateProductV1(product);
  errors.push(...structural.errors);
  warnings.push(...structural.warnings);

  if (!structural.valid || typeof product !== "object" || product === null) {
    return result(errors, warnings);
  }

  const doc = product as ProductV1Document;

  if (options?.existingId && doc.id !== options.existingId) {
    errors.push(
      `Product id is immutable (expected "${options.existingId}", got "${doc.id}").`,
    );
  }

  const asinError = validateAsinForProductSave(doc.commerce?.asin);
  if (asinError) errors.push(asinError);

  return result(errors, warnings);
}

export async function validateAdminArticleSave(
  article: unknown,
  options?: { existingId?: string; body?: string },
): Promise<AdminSaveResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const structural = validateArticleV1(article);
  errors.push(...structural.errors);
  warnings.push(...structural.warnings);

  if (!structural.valid || typeof article !== "object" || article === null) {
    return result(errors, warnings);
  }

  const doc = article as ArticleV1;

  if (options?.existingId && doc.identity.id !== options.existingId) {
    errors.push(
      `Article identity.id is immutable (expected "${options.existingId}", got "${doc.identity.id}").`,
    );
  }

  const template = validateArticleV1TemplateRules(doc);
  errors.push(...template.errors);
  warnings.push(...template.warnings);

  const productIds = new Set(await listProductV1Ids());
  const missingSeverity = isPublishedArticleV1(doc) ? "error" : "warning";
  const productRefs = validateArticleV1ProductRefs(
    doc,
    (productId) => productIds.has(productId),
    { missingProductSeverity: missingSeverity },
  );
  errors.push(...productRefs.errors);
  warnings.push(...productRefs.warnings);

  if (isPublishedArticleV1(doc) && options?.body !== undefined && !options.body.trim()) {
    errors.push("Published articles must have a Markdown body.");
  }

  if (doc.publishing.status === "scheduled") {
    if (!doc.publishing.scheduledAt) {
      errors.push("Scheduled articles require a future publish time (publishing.scheduledAt).");
    } else {
      const scheduledMs = new Date(doc.publishing.scheduledAt).getTime();
      if (Number.isNaN(scheduledMs)) {
        errors.push("publishing.scheduledAt must be a valid ISO 8601 timestamp.");
      } else if (scheduledMs <= Date.now()) {
        errors.push("Scheduled publish time must be in the future. Select 'published' for immediate publication.");
      }
    }
    if (options?.body !== undefined && !options.body.trim()) {
      errors.push("Scheduled articles must have a Markdown body before scheduling.");
    }
  }

  return result(errors, warnings);
}

export async function validateAdminProductCreate(
  product: unknown,
  options?: { existingIds?: Iterable<string> },
): Promise<AdminSaveResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!product || typeof product !== "object") {
    return result(["Product V1 must be an object."], warnings);
  }

  const doc = product as ProductV1Document;
  const idError = validateProductIdFormat(doc.id ?? "");
  if (idError) errors.push(idError);

  const existing = new Set(options?.existingIds ?? (await listProductV1Ids()));
  if (doc.id && existing.has(doc.id)) {
    errors.push("A product with this ID already exists.");
  }

  const structural = validateProductV1(product);
  errors.push(...structural.errors.filter((error) => error !== "id is required."));
  warnings.push(...structural.warnings);

  if (structural.valid) {
    const related = doc.relationships?.relatedProducts ?? [];
    for (const relatedId of related) {
      if (relatedId === doc.id) {
        errors.push("relationships.relatedProducts must not include self id.");
      } else if (!existing.has(relatedId)) {
        errors.push(`Related product does not exist: ${relatedId}`);
      }
    }
    const asinError = validateAsinForProductSave(doc.commerce?.asin);
    if (asinError) errors.push(asinError);
  }

  return result([...new Set(errors)], warnings);
}

export async function validateAdminArticleCreate(
  article: unknown,
  options?: {
    existingIds?: Iterable<string>;
    existingSlugs?: Iterable<string>;
  },
): Promise<AdminSaveResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!article || typeof article !== "object") {
    return result(["Article V1 must be an object."], warnings);
  }

  const doc = article as ArticleV1;
  const idError = validateArticleIdFormat(doc.identity?.id ?? "");
  if (idError) errors.push(idError);
  const slugError = validateArticleSlugFormat(doc.identity?.slug ?? "");
  if (slugError) errors.push(slugError);

  if (doc.publishing?.status && doc.publishing.status !== "draft") {
    errors.push("New articles must be created as draft. Publish later from the editor.");
  }

  let existingIds = options?.existingIds ? new Set(options.existingIds) : null;
  let existingSlugs = options?.existingSlugs ? new Set(options.existingSlugs) : null;
  if (!existingIds || !existingSlugs) {
    const { listArticlesV1 } = await import("@/lib/content/articles");
    const articles = await listArticlesV1();
    existingIds = existingIds ?? new Set(articles.map((item) => item.identity.id));
    existingSlugs = existingSlugs ?? new Set(articles.map((item) => item.identity.slug));
  }

  if (doc.identity?.id && existingIds.has(doc.identity.id)) {
    errors.push("An article with this ID already exists.");
  }
  if (doc.identity?.slug && existingSlugs.has(doc.identity.slug)) {
    errors.push("An article with this slug already exists.");
  }
  if (doc.identity?.slug && articleMarkdownExists(doc.identity.slug)) {
    errors.push("A Markdown body already exists for this slug.");
  }

  const structural = validateArticleV1(article);
  for (const error of structural.errors) {
    if (error.includes("identity.id") || error === "identity.id is required.") {
      if (!idError) errors.push(error);
      continue;
    }
    if (error.includes("identity.slug") || error === "identity.slug is required.") {
      if (!slugError) errors.push(error);
      continue;
    }
    errors.push(error);
  }
  warnings.push(...structural.warnings);

  const template = validateArticleV1TemplateRules(doc);
  errors.push(...template.errors);
  warnings.push(...template.warnings);

  const productIds = new Set(await listProductV1Ids());
  const productRefs = validateArticleV1ProductRefs(doc, (productId) => productIds.has(productId), {
    missingProductSeverity: "error",
  });
  errors.push(...productRefs.errors);
  warnings.push(...productRefs.warnings);

  return result([...new Set(errors)], warnings);
}

