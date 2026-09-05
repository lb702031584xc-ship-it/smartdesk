/**
 * Controlled Article metadata mutation boundary (Phase 35).
 *
 * Admin UI → this module → Validation → Revision → Neon → Revalidation
 *
 * Only editorial.{summary,audience,intent} and
 * seo.{metaTitle,metaDescription,primaryKeyword,secondaryKeywords}.
 * Markdown body, products, relationships, and publishing are forbidden.
 */
import type {
  ArticleEditorialV1,
  ArticleSearchIntent,
  ArticleSeoV1,
  ArticleV1,
} from "@/types/article-v1";
import { getAdminArticle, saveAdminArticle } from "@/lib/admin/article-store";
import { collectArticleRevalidationPaths } from "@/lib/admin/revalidate-content";
import { assertWorkflowAllowsMutation } from "@/lib/editorial-workflow";
import { listArticleRevisions } from "@/lib/db/revisions";
import { isDatabaseContentStore } from "@/lib/content/store-config";

export const EDITABLE_ARTICLE_EDITORIAL_FIELDS = [
  "summary",
  "audience",
  "intent",
] as const;

export const EDITABLE_ARTICLE_SEO_FIELDS = [
  "metaTitle",
  "metaDescription",
  "primaryKeyword",
  "secondaryKeywords",
] as const;

export const ARTICLE_SEARCH_INTENTS: readonly ArticleSearchIntent[] = [
  "informational",
  "commercial",
  "transactional",
  "mixed",
];

export type ArticleEditorialFieldChanges = {
  summary?: string;
  audience?: string[];
  intent?: ArticleSearchIntent;
};

export type ArticleSeoFieldChanges = {
  metaTitle?: string;
  metaDescription?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
};

export type ArticleMetadataChanges = {
  editorial?: ArticleEditorialFieldChanges;
  seo?: ArticleSeoFieldChanges;
};

export type UpdateArticleMetadataInput = {
  articleId: string;
  changes: unknown;
  expectedVersion: number;
  actor: string;
};

export type ArticleMutationErrorCode =
  | "ARTICLE_NOT_FOUND"
  | "VERSION_CONFLICT"
  | "FIELD_NOT_EDITABLE"
  | "INVALID_ENUM"
  | "INVALID_VALUE"
  | "SCHEMA_DRIFT"
  | "WRITE_DISABLED"
  | "SAVE_FAILED"
  | "INVALID_INPUT"
  | "WORKFLOW_LOCKED";

export type ArticleMutationSuccess = {
  success: true;
  revisionId: string | null;
  updatedArticle: ArticleV1;
  version: number;
  revisionCreated: boolean;
  revalidated?: boolean;
  /** Planned public paths from existing revalidation planner. */
  dependencyPaths: string[];
};

export type ArticleMutationFailure = {
  success: false;
  error: ArticleMutationErrorCode;
  message: string;
};

export type ArticleMutationResult = ArticleMutationSuccess | ArticleMutationFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * Reject forbidden / unknown fields before any merge or write.
 * Pure — safe for unit tests without DB.
 */
export function validateArticleMetadataChanges(
  changes: unknown,
):
  | { ok: true; changes: ArticleMetadataChanges }
  | { ok: false; error: ArticleMutationErrorCode; message: string } {
  if (!isRecord(changes)) {
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: "changes must be an object.",
    };
  }

  const allowedTop = new Set(["editorial", "seo"]);
  for (const key of Object.keys(changes)) {
    if (!allowedTop.has(key)) {
      return {
        ok: false,
        error: "FIELD_NOT_EDITABLE",
        message: `Field "${key}" is not editable via article metadata mutation.`,
      };
    }
  }

  if (!("editorial" in changes) && !("seo" in changes)) {
    return {
      ok: false,
      error: "INVALID_INPUT",
      message: "Provide editorial and/or seo changes.",
    };
  }

  const next: ArticleMetadataChanges = {};

  if ("editorial" in changes) {
    if (!isRecord(changes.editorial)) {
      return {
        ok: false,
        error: "SCHEMA_DRIFT",
        message: "editorial must be an object.",
      };
    }
    const editorial = changes.editorial;
    const allowed = new Set<string>(EDITABLE_ARTICLE_EDITORIAL_FIELDS);
    for (const key of Object.keys(editorial)) {
      if (!allowed.has(key)) {
        return {
          ok: false,
          error: "FIELD_NOT_EDITABLE",
          message: `editorial.${key} is not editable in Phase 35.`,
        };
      }
    }

    const patch: ArticleEditorialFieldChanges = {};

    if ("summary" in editorial) {
      if (editorial.summary !== undefined && typeof editorial.summary !== "string") {
        return {
          ok: false,
          error: "INVALID_VALUE",
          message: "editorial.summary must be a string when present.",
        };
      }
      patch.summary = editorial.summary as string | undefined;
    }

    if ("audience" in editorial) {
      if (editorial.audience !== undefined && !isStringArray(editorial.audience)) {
        return {
          ok: false,
          error: "INVALID_VALUE",
          message: "editorial.audience must be a string array when present.",
        };
      }
      patch.audience = editorial.audience as string[] | undefined;
    }

    if ("intent" in editorial) {
      const intent = editorial.intent;
      if (
        typeof intent !== "string" ||
        !ARTICLE_SEARCH_INTENTS.includes(intent as ArticleSearchIntent)
      ) {
        return {
          ok: false,
          error: "INVALID_ENUM",
          message: `editorial.intent must be one of: ${ARTICLE_SEARCH_INTENTS.join(", ")}.`,
        };
      }
      patch.intent = intent as ArticleSearchIntent;
    }

    if (Object.keys(patch).length === 0) {
      return {
        ok: false,
        error: "INVALID_INPUT",
        message: "editorial object has no editable fields.",
      };
    }
    next.editorial = patch;
  }

  if ("seo" in changes) {
    if (!isRecord(changes.seo)) {
      return {
        ok: false,
        error: "SCHEMA_DRIFT",
        message: "seo must be an object.",
      };
    }
    const seo = changes.seo;
    const allowed = new Set<string>(EDITABLE_ARTICLE_SEO_FIELDS);
    for (const key of Object.keys(seo)) {
      if (!allowed.has(key)) {
        return {
          ok: false,
          error: "FIELD_NOT_EDITABLE",
          message: `seo.${key} is not editable in Phase 35.`,
        };
      }
    }

    const patch: ArticleSeoFieldChanges = {};

    for (const field of ["metaTitle", "metaDescription", "primaryKeyword"] as const) {
      if (field in seo) {
        if (seo[field] !== undefined && typeof seo[field] !== "string") {
          return {
            ok: false,
            error: "INVALID_VALUE",
            message: `seo.${field} must be a string when present.`,
          };
        }
        patch[field] = seo[field] as string | undefined;
      }
    }

    if ("secondaryKeywords" in seo) {
      if (
        seo.secondaryKeywords !== undefined &&
        !isStringArray(seo.secondaryKeywords)
      ) {
        return {
          ok: false,
          error: "INVALID_VALUE",
          message: "seo.secondaryKeywords must be a string array when present.",
        };
      }
      patch.secondaryKeywords = seo.secondaryKeywords as string[] | undefined;
    }

    if (Object.keys(patch).length === 0) {
      return {
        ok: false,
        error: "INVALID_INPUT",
        message: "seo object has no editable fields.",
      };
    }
    next.seo = patch;
  }

  return { ok: true, changes: next };
}

/**
 * Merge allowlisted metadata onto an existing article.
 * Preserves body (not in document), products, relationships, publishing, identity.
 */
export function applyArticleMetadataChanges(
  article: ArticleV1,
  changes: ArticleMetadataChanges,
): ArticleV1 {
  const editorial: ArticleEditorialV1 = { ...article.editorial };
  if (changes.editorial) {
    const patch = changes.editorial;
    if ("summary" in patch) {
      if (!patch.summary) {
        delete editorial.summary;
      } else {
        editorial.summary = patch.summary;
      }
    }
    if ("audience" in patch) {
      if (patch.audience === undefined) {
        delete editorial.audience;
      } else {
        editorial.audience = patch.audience;
      }
    }
    if ("intent" in patch && patch.intent) {
      editorial.intent = patch.intent;
    }
  }

  let seo: ArticleSeoV1 | undefined = article.seo
    ? { ...article.seo }
    : undefined;
  if (changes.seo) {
    seo = { ...(seo ?? {}) };
    const patch = changes.seo;
    for (const field of ["metaTitle", "metaDescription", "primaryKeyword"] as const) {
      if (field in patch) {
        const value = patch[field];
        if (!value) {
          delete seo[field];
        } else {
          seo[field] = value;
        }
      }
    }
    if ("secondaryKeywords" in patch) {
      if (patch.secondaryKeywords === undefined) {
        delete seo.secondaryKeywords;
      } else {
        seo.secondaryKeywords = patch.secondaryKeywords;
      }
    }
  }

  return {
    ...article,
    editorial,
    seo: seo && Object.keys(seo).length > 0 ? seo : undefined,
  };
}

/**
 * Controlled update of Article metadata fields only.
 * Uses existing Admin save path for revision + Neon write + revalidation.
 * Does not accept or modify Markdown body.
 */
export async function updateArticleMetadataFields(
  input: UpdateArticleMetadataInput,
): Promise<ArticleMutationResult> {
  if (!input.articleId || typeof input.articleId !== "string") {
    return {
      success: false,
      error: "INVALID_INPUT",
      message: "articleId is required.",
    };
  }
  if (!input.actor || typeof input.actor !== "string") {
    return {
      success: false,
      error: "INVALID_INPUT",
      message: "actor is required.",
    };
  }
  if (
    typeof input.expectedVersion !== "number" ||
    !Number.isInteger(input.expectedVersion)
  ) {
    return {
      success: false,
      error: "INVALID_INPUT",
      message: "expectedVersion must be an integer.",
    };
  }

  const parsed = validateArticleMetadataChanges(input.changes);
  if (!parsed.ok) {
    return {
      success: false,
      error: parsed.error,
      message: parsed.message,
    };
  }

  const existing = await getAdminArticle(input.articleId);
  if (!existing) {
    return {
      success: false,
      error: "ARTICLE_NOT_FOUND",
      message: `Article not found: ${input.articleId}`,
    };
  }

  const workflowLock = await assertWorkflowAllowsMutation(
    "article",
    input.articleId,
  );
  if (workflowLock) {
    return {
      success: false,
      error: "WORKFLOW_LOCKED",
      message: workflowLock.message,
    };
  }

  const beforeBody = existing.body ?? "";
  const merged = applyArticleMetadataChanges(existing.article, parsed.changes);

  const saveResult = await saveAdminArticle(merged, {
    expectedVersion: input.expectedVersion,
    actor: input.actor,
    // Explicitly pass existing body so Markdown is never altered or cleared.
    body: beforeBody,
  });

  if (saveResult.blocked) {
    return {
      success: false,
      error: "WRITE_DISABLED",
      message: saveResult.blockedReason ?? "Admin write mode is disabled.",
    };
  }

  if (!saveResult.ok) {
    const stale = saveResult.errors.some((e) =>
      e.toLowerCase().includes("changed after you opened"),
    );
    if (stale) {
      return {
        success: false,
        error: "VERSION_CONFLICT",
        message: saveResult.errors[0] ?? "Version conflict.",
      };
    }
    return {
      success: false,
      error: "SAVE_FAILED",
      message: saveResult.errors[0] ?? "Save failed.",
    };
  }

  const updated = await getAdminArticle(input.articleId);
  if (!updated) {
    return {
      success: false,
      error: "SAVE_FAILED",
      message: "Article missing after save.",
    };
  }

  if ((updated.body ?? "") !== beforeBody) {
    return {
      success: false,
      error: "SAVE_FAILED",
      message: "Markdown body changed unexpectedly during metadata mutation.",
    };
  }

  let revisionId: string | null = null;
  if (saveResult.revisionCreated && isDatabaseContentStore()) {
    const revisions = await listArticleRevisions(input.articleId);
    revisionId = revisions[0]?.id ?? null;
  }

  const dependencyPaths = collectArticleRevalidationPaths({
    slug: updated.article.identity.slug,
    previousStatus: existing.article.publishing.status,
    nextStatus: updated.article.publishing.status,
    category: updated.article.classification.category,
    listingFieldsChanged: false,
    featuredChanged: false,
  });

  return {
    success: true,
    revisionId,
    updatedArticle: updated.article,
    version: saveResult.version ?? updated.version ?? input.expectedVersion,
    revisionCreated: Boolean(saveResult.revisionCreated),
    revalidated: saveResult.revalidated,
    dependencyPaths,
  };
}
