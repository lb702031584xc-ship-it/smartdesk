import { normalizeArticleV1 } from "./normalize-article";
import { normalizeProductV1 } from "./normalize-product";
import {
  countArticleRevisions,
  countProductRevisions,
  getArticleRevision,
  getProductRevision,
  listArticleRevisions,
  listProductRevisions,
  upsertDatabaseArticleV1WithRevision,
  upsertDatabaseProductV1WithRevision,
} from "@/lib/db/revisions";
import { clearArticleCache } from "@/lib/articles";
import { clearProductCache } from "@/lib/products";
import { isDatabaseContentStore } from "@/lib/content/store-config";
import {
  revalidateArticlePublicContent,
  revalidateProductPublicContent,
  revalidationWarning,
} from "./revalidate-content";
import {
  summarizeArticleRevisionChanges,
  summarizeProductRevisionChanges,
} from "./revision-diff";
import { validateAdminArticleSave, validateAdminProductSave } from "./validate-save";
import type { AdminSaveResult } from "./types";
import type { ArticleV1 } from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";
import { getAdminArticle } from "./article-store";
import { getAdminProduct } from "./product-store";

export type RevisionListItem = {
  id: string;
  revisionNumber: number;
  createdAt: string;
  createdBy: string;
  sourceVersion: number;
  changedSections: string[];
};

export type ArticleRevisionDetail = RevisionListItem & {
  data: ArticleV1;
  body: string;
};

export type ProductRevisionDetail = RevisionListItem & {
  data: ProductV1Document;
};

function formatTimestamp(value: Date): string {
  return value.toISOString();
}

export async function getArticleRevisionCount(articleId: string): Promise<number> {
  if (!isDatabaseContentStore()) return 0;
  return countArticleRevisions(articleId);
}

export async function getProductRevisionCount(productId: string): Promise<number> {
  if (!isDatabaseContentStore()) return 0;
  return countProductRevisions(productId);
}

export async function listArticleRevisionItems(articleId: string): Promise<RevisionListItem[]> {
  const revisions = await listArticleRevisions(articleId);
  const current = await getAdminArticle(articleId);

  return revisions.map((revision, index) => {
    const newer =
      index === 0
        ? current
          ? { data: current.article, body: current.body ?? "" }
          : undefined
        : { data: revisions[index - 1]!.data, body: revisions[index - 1]!.body };

    const changedSections = newer
      ? summarizeArticleRevisionChanges(
          revision.data,
          newer.data,
          revision.body,
          newer.body,
        )
      : [];

    return {
      id: revision.id,
      revisionNumber: revision.revisionNumber,
      createdAt: formatTimestamp(revision.createdAt),
      createdBy: revision.createdBy,
      sourceVersion: revision.sourceVersion,
      changedSections,
    };
  });
}

export async function listProductRevisionItems(productId: string): Promise<RevisionListItem[]> {
  const revisions = await listProductRevisions(productId);
  const current = await getAdminProduct(productId);

  return revisions.map((revision, index) => {
    const newer =
      index === 0
        ? current
          ? { data: current.product }
          : undefined
        : { data: revisions[index - 1]!.data };

    const changedSections = newer
      ? summarizeProductRevisionChanges(revision.data, newer.data)
      : [];

    return {
      id: revision.id,
      revisionNumber: revision.revisionNumber,
      createdAt: formatTimestamp(revision.createdAt),
      createdBy: revision.createdBy,
      sourceVersion: revision.sourceVersion,
      changedSections,
    };
  });
}

export async function getArticleRevisionDetail(
  articleId: string,
  revisionId: string,
): Promise<ArticleRevisionDetail | undefined> {
  const revision = await getArticleRevision(articleId, revisionId);
  if (!revision) return undefined;

  const items = await listArticleRevisionItems(articleId);
  const summary = items.find((item) => item.id === revisionId);

  return {
    id: revision.id,
    revisionNumber: revision.revisionNumber,
    createdAt: formatTimestamp(revision.createdAt),
    createdBy: revision.createdBy,
    sourceVersion: revision.sourceVersion,
    changedSections: summary?.changedSections ?? [],
    data: revision.data,
    body: revision.body,
  };
}

export async function getProductRevisionDetail(
  productId: string,
  revisionId: string,
): Promise<ProductRevisionDetail | undefined> {
  const revision = await getProductRevision(productId, revisionId);
  if (!revision) return undefined;

  const items = await listProductRevisionItems(productId);
  const summary = items.find((item) => item.id === revisionId);

  return {
    id: revision.id,
    revisionNumber: revision.revisionNumber,
    createdAt: formatTimestamp(revision.createdAt),
    createdBy: revision.createdBy,
    sourceVersion: revision.sourceVersion,
    changedSections: summary?.changedSections ?? [],
    data: revision.data,
  };
}

export async function restoreArticleRevision(
  articleId: string,
  revisionId: string,
  options: { expectedVersion: number; actor: string },
): Promise<AdminSaveResult> {
  if (!isDatabaseContentStore()) {
    return {
      ok: false,
      errors: [],
      warnings: [],
      blocked: true,
      blockedReason: "Revision restore requires CONTENT_STORE=database.",
    };
  }

  const current = await getAdminArticle(articleId);
  if (!current) {
    return { ok: false, errors: [`Article not found: ${articleId}`], warnings: [] };
  }

  const revision = await getArticleRevision(articleId, revisionId);
  if (!revision) {
    return { ok: false, errors: ["Revision not found."], warnings: [] };
  }

  const canonical = normalizeArticleV1(revision.data);
  const validation = await validateAdminArticleSave(canonical, {
    existingId: articleId,
    body: revision.body,
  });
  if (!validation.ok) {
    return {
      ok: false,
      errors: [
        "This revision cannot be restored under the current schema.",
        ...validation.errors,
      ],
      warnings: validation.warnings,
    };
  }

  const saveResult = await upsertDatabaseArticleV1WithRevision(canonical, revision.body, {
    expectedVersion: options.expectedVersion,
    createdBy: options.actor,
  });

  if (!saveResult.ok) {
    return {
      ok: false,
      errors: ["This record changed after you opened it. Reload before restoring."],
      warnings: validation.warnings,
    };
  }

  clearArticleCache();

  const revalidation = await revalidateArticlePublicContent({
    slug: canonical.identity.slug,
    previousStatus: current.article.publishing.status,
    nextStatus: canonical.publishing.status,
    previousSlug:
      current.article.identity.slug !== canonical.identity.slug
        ? current.article.identity.slug
        : undefined,
    featuredChanged: current.article.publishing.featured !== canonical.publishing.featured,
    listingFieldsChanged:
      current.article.identity.title !== canonical.identity.title ||
      current.article.publishing.featured !== canonical.publishing.featured ||
      current.article.publishing.status !== canonical.publishing.status ||
      current.article.classification.category !== canonical.classification.category,
    category: canonical.classification.category ?? current.article.classification.category,
  });

  const warnings = [...validation.warnings];
  const refreshWarning = revalidationWarning(revalidation);
  if (refreshWarning) warnings.push(refreshWarning);

  return {
    ok: true,
    errors: [],
    warnings,
    version: saveResult.version,
    revalidated: revalidation.attempted && revalidation.ok ? true : undefined,
  };
}

export async function restoreProductRevision(
  productId: string,
  revisionId: string,
  options: { expectedVersion: number; actor: string },
): Promise<AdminSaveResult> {
  if (!isDatabaseContentStore()) {
    return {
      ok: false,
      errors: [],
      warnings: [],
      blocked: true,
      blockedReason: "Revision restore requires CONTENT_STORE=database.",
    };
  }

  const current = await getAdminProduct(productId);
  if (!current) {
    return { ok: false, errors: [`Product not found: ${productId}`], warnings: [] };
  }

  const revision = await getProductRevision(productId, revisionId);
  if (!revision) {
    return { ok: false, errors: ["Revision not found."], warnings: [] };
  }

  const canonical = normalizeProductV1(revision.data);
  const validation = validateAdminProductSave(canonical, { existingId: productId });
  if (!validation.ok) {
    return {
      ok: false,
      errors: [
        "This revision cannot be restored under the current schema.",
        ...validation.errors,
      ],
      warnings: validation.warnings,
    };
  }

  const saveResult = await upsertDatabaseProductV1WithRevision(canonical, {
    expectedVersion: options.expectedVersion,
    createdBy: options.actor,
  });

  if (!saveResult.ok) {
    return {
      ok: false,
      errors: ["This record changed after you opened it. Reload before restoring."],
      warnings: validation.warnings,
    };
  }

  clearProductCache();

  const revalidation = await revalidateProductPublicContent({
    productId,
    category: canonical.identity.category,
    featuredChanged: current.product.editorial?.featured !== canonical.editorial?.featured,
  });

  const warnings = [...validation.warnings];
  const refreshWarning = revalidationWarning(revalidation);
  if (refreshWarning) warnings.push(refreshWarning);

  return {
    ok: true,
    errors: [],
    warnings,
    version: saveResult.version,
    revalidated: revalidation.attempted && revalidation.ok ? true : undefined,
  };
}
