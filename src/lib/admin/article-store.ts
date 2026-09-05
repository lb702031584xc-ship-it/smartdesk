import {
  deleteArticleV1Record,
  getArticleV1,
  insertArticleV1,
  listArticleV1Ids,
  listArticlesV1,
  saveArticleV1,
} from "@/lib/content/articles";
import {
  createArticleMarkdownBody,
  deleteArticleMarkdownBody,
} from "@/lib/content/article-markdown";
import { isDatabaseContentStore } from "@/lib/content/store-config";
import { clearArticleCache } from "@/lib/articles";
import type { ArticleV1 } from "@/types/article-v1";
import { isAdminWriteEnabled } from "./persistence";
import {
  articleCreateDisabledReason,
  isArticleCreateEnabled,
} from "./article-create-policy";
import { normalizeArticleV1 } from "./normalize-article";
import {
  revalidateArticlePublicContent,
  revalidationWarning,
} from "./revalidate-content";
import type {
  AdminArticleRecord,
  AdminSaveResult,
  ArticleListItem,
} from "./types";
import { deleteArticleRevisionsForArticle } from "@/lib/db/revisions";
import { validateAdminArticleCreate, validateAdminArticleSave } from "./validate-save";

function toListItem(article: ArticleV1): ArticleListItem {
  return {
    id: article.identity.id,
    title: article.identity.title,
    slug: article.identity.slug,
    type: article.classification.type,
    category: article.classification.category,
    status: article.publishing.status,
    intent: article.editorial.intent,
    primaryKeyword: article.seo?.primaryKeyword,
    updatedAt: article.publishing.updatedAt,
    scheduledAt: article.publishing.scheduledAt,
    featured: Boolean(article.publishing.featured),
  };
}

export async function listAdminArticleIds(): Promise<string[]> {
  return await listArticleV1Ids();
}

export async function listAdminArticles(): Promise<ArticleListItem[]> {
  const articles = await listArticlesV1();
  return articles.map(toListItem);
}

export async function getAdminArticle(id: string): Promise<AdminArticleRecord | undefined> {
  const record = await getArticleV1(id);
  if (!record) return undefined;
  return {
    article: record.article,
    sourceFile: record.sourceFile,
    body: record.body,
    version: record.version,
  };
}

export async function saveAdminArticle(
  article: ArticleV1,
  options?: { expectedVersion?: number; body?: string; actor?: string },
): Promise<AdminSaveResult> {
  if (!isAdminWriteEnabled()) {
    return {
      ok: false,
      errors: [],
      warnings: [],
      blocked: true,
      blockedReason:
        "Admin write mode is disabled. Set CONTENT_STORE=database with DATABASE_URL, or use local development filesystem mode.",
    };
  }

  if (options?.body !== undefined && typeof options.body !== "string") {
    return {
      ok: false,
      errors: ["Article body must be a string."],
      warnings: [],
    };
  }

  const existing = await getAdminArticle(article.identity.id);
  if (!existing) {
    return {
      ok: false,
      errors: [`Article not found: ${article.identity.id}`],
      warnings: [],
    };
  }

  const body = options?.body ?? existing.body ?? "";

  const validation = await validateAdminArticleSave(article, {
    existingId: existing.article.identity.id,
    body,
  });

  if (!validation.ok) {
    return validation;
  }

  if (article.publishing.status === "published" || article.publishing.status === "scheduled") {
    const { evaluateArticleReadiness } = await import("@/lib/editorial/article-readiness");
    const { listProductsV1 } = await import("@/lib/content/products");
    const { listArticlesV1 } = await import("@/lib/content/articles");
    const products = await listProductsV1();
    const allArticles = await listArticlesV1();
    const knownSlugs = new Set(allArticles.map((a) => a.identity.slug));
    const readiness = evaluateArticleReadiness(article, body, products, { knownSlugs });
    if (!readiness.ready) {
      return {
        ok: false,
        errors: readiness.blockers.map((b) => b.message),
        warnings: readiness.warnings.map((w) => w.message),
      };
    }
  }

  let saveResult;
  try {
    saveResult = await saveArticleV1(article, body, {
      sourceFile: existing.sourceFile,
      expectedVersion: options?.expectedVersion ?? existing.version,
      createdBy: options?.actor,
    });
  } catch {
    return {
      ok: false,
      errors: ["Database save failed."],
      warnings: validation.warnings,
    };
  }

  if (!saveResult.ok && "stale" in saveResult && saveResult.stale) {
    return {
      ok: false,
      errors: [
        "This record changed after you opened it. Reload before saving.",
      ],
      warnings: validation.warnings,
    };
  }

  if (!saveResult.ok && "error" in saveResult) {
    return {
      ok: false,
      errors: ["Database save failed."],
      warnings: validation.warnings,
    };
  }

  clearArticleCache();

  const previous = existing.article;
  const revalidation = await revalidateArticlePublicContent({
    slug: article.identity.slug,
    previousStatus: previous.publishing.status,
    nextStatus: article.publishing.status,
    previousSlug:
      previous.identity.slug !== article.identity.slug ? previous.identity.slug : undefined,
    featuredChanged: previous.publishing.featured !== article.publishing.featured,
    listingFieldsChanged:
      previous.identity.title !== article.identity.title ||
      previous.publishing.featured !== article.publishing.featured ||
      previous.publishing.status !== article.publishing.status ||
      previous.classification.category !== article.classification.category,
    category: article.classification.category ?? previous.classification.category,
  });

  const warnings = [...validation.warnings];
  const refreshWarning = revalidationWarning(revalidation);
  if (refreshWarning) warnings.push(refreshWarning);

  return {
    ok: true,
    errors: [],
    warnings,
    version: saveResult.ok ? saveResult.version : undefined,
    revalidated: revalidation.attempted && revalidation.ok ? true : undefined,
    revisionCreated: saveResult.ok ? saveResult.revisionCreated : undefined,
  };
}

export async function countArticlesByStatus(
  status: ArticleV1["publishing"]["status"],
): Promise<number> {
  const items = await listAdminArticles();
  return items.filter((item) => item.status === status).length;
}

export async function getAdminOverviewArticleCount(): Promise<number> {
  return (await listAdminArticles()).length;
}

export async function createAdminArticle(
  article: ArticleV1,
  options?: { body?: string },
): Promise<AdminSaveResult> {
  if (!isDatabaseContentStore()) {
    return {
      ok: false,
      errors: [],
      warnings: [],
      blocked: true,
      blockedReason:
        "Article creation requires CONTENT_STORE=database so metadata authority stays in Neon.",
    };
  }

  if (!isAdminWriteEnabled()) {
    return {
      ok: false,
      errors: [],
      warnings: [],
      blocked: true,
      blockedReason:
        "Admin write mode is disabled. Set CONTENT_STORE=database with DATABASE_URL.",
    };
  }

  if (!isArticleCreateEnabled()) {
    return {
      ok: false,
      errors: [],
      warnings: [],
      blocked: true,
      blockedReason: articleCreateDisabledReason(),
    };
  }

  if (article.publishing?.status && article.publishing.status !== "draft") {
    return {
      ok: false,
      errors: ["New articles must be created as draft. Publish later from the editor."],
      warnings: [],
    };
  }

  const canonical = normalizeArticleV1({
    ...article,
    publishing: {
      ...article.publishing,
      status: "draft",
      featured: Boolean(article.publishing?.featured),
    },
  });

  const existing = await listArticlesV1();
  const validation = await validateAdminArticleCreate(canonical, {
    existingIds: existing.map((item) => item.identity.id),
    existingSlugs: existing.map((item) => item.identity.slug),
  });
  if (!validation.ok) {
    return validation;
  }

  const markdown = createArticleMarkdownBody(canonical.identity.slug);
  if (!markdown.ok) {
    if (markdown.reason === "exists") {
      return {
        ok: false,
        errors: ["A Markdown body already exists for this slug."],
        warnings: validation.warnings,
      };
    }
    return {
      ok: false,
      errors: [
        "Could not create the Markdown body file. Article creation requires a writable content/posts directory.",
      ],
      warnings: validation.warnings,
    };
  }

  const body = options?.body ?? "";
  let insertResult;
  try {
    insertResult = await insertArticleV1(canonical, body);
  } catch {
    deleteArticleMarkdownBody(canonical.identity.slug);
    return {
      ok: false,
      errors: ["Database save failed."],
      warnings: validation.warnings,
    };
  }

  if (!insertResult.ok && "duplicate" in insertResult) {
    deleteArticleMarkdownBody(canonical.identity.slug);
    return {
      ok: false,
      errors: [
        insertResult.duplicate === "slug"
          ? "An article with this slug already exists."
          : "An article with this ID already exists.",
      ],
      warnings: validation.warnings,
    };
  }

  if (!insertResult.ok) {
    deleteArticleMarkdownBody(canonical.identity.slug);
    return {
      ok: false,
      errors: ["Database save failed."],
      warnings: validation.warnings,
    };
  }

  clearArticleCache();
  return {
    ok: true,
    errors: [],
    warnings: validation.warnings,
    version: insertResult.version,
  };
}

/** Store-level cleanup for validation scripts. Not exposed in Admin UI. */
export async function deleteAdminArticleRecord(id: string, slug?: string): Promise<void> {
  const record = await getAdminArticle(id);
  const targetSlug = slug ?? record?.article.identity.slug;
  if (isDatabaseContentStore()) {
    await deleteArticleRevisionsForArticle(id);
  }
  await deleteArticleV1Record(id);
  if (targetSlug) {
    deleteArticleMarkdownBody(targetSlug);
  }
  clearArticleCache();
}
