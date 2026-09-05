/**
 * Controlled Article structured content mutation boundary (Phase 39).
 *
 * Admin → validation → workflow lock → serialize blocks → body write
 * → revision → Neon. ArticleV1 JSON unchanged except via other boundaries.
 *
 * Does NOT modify ArticleV1 schema. Body string remains canonical prose store.
 */
import type { ArticleV1 } from "@/types/article-v1";
import type { ContentBlock } from "@/types/content-document";
import { getAdminArticle, saveAdminArticle } from "@/lib/admin/article-store";
import { collectArticleRevalidationPaths } from "@/lib/admin/revalidate-content";
import { validateContentBlocks } from "@/lib/content-blocks";
import { assertWorkflowAllowsMutation } from "@/lib/editorial-workflow";
import { listArticleRevisions } from "@/lib/db/revisions";
import { isDatabaseContentStore } from "@/lib/content/store-config";
import { listProductsV1 } from "@/lib/content/products";
import { listFilesystemProductsV1 } from "@/lib/content/filesystem-products";
import { serializeContentBlocksToMarkdown } from "@/lib/markdown/serialize-article-content";

export type ContentMutationErrorCode =
  | "ARTICLE_NOT_FOUND"
  | "VERSION_CONFLICT"
  | "INVALID_BLOCKS"
  | "INVALID_INPUT"
  | "WRITE_DISABLED"
  | "SAVE_FAILED"
  | "WORKFLOW_LOCKED"
  | "NO_CONTENT_CHANGE";

export type UpdateArticleContentBlocksInput = {
  articleId: string;
  blocks: unknown;
  expectedVersion: number;
  actor: string;
};

export type ContentMutationSuccess = {
  success: true;
  revisionId: string | null;
  updatedArticle: ArticleV1;
  version: number;
  revisionCreated: boolean;
  revalidated?: boolean;
  body: string;
  dependencyPaths: string[];
};

export type ContentMutationFailure = {
  success: false;
  error: ContentMutationErrorCode;
  message: string;
};

export type ContentMutationResult = ContentMutationSuccess | ContentMutationFailure;

async function resolveCatalogProductIds(): Promise<Set<string>> {
  const products = isDatabaseContentStore()
    ? await listProductsV1()
    : listFilesystemProductsV1();
  return new Set(products.map((p) => p.id));
}

/**
 * Controlled update of article Markdown via validated content blocks.
 * Serializes to body string — no ArticleV1 schema extension.
 */
export async function updateArticleContentBlocks(
  input: UpdateArticleContentBlocksInput,
): Promise<ContentMutationResult> {
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

  const catalogIds = await resolveCatalogProductIds();
  const articleProductIds = (existing.article.products?.primary ?? []).map(
    (p) => p.productId,
  );
  const knownProductIds = new Set([...catalogIds, ...articleProductIds]);

  const validation = validateContentBlocks(input.blocks, { knownProductIds });
  if (!validation.valid) {
    return {
      success: false,
      error: "INVALID_BLOCKS",
      message:
        validation.errors[0]?.message ?? "Content block validation failed.",
    };
  }

  const blocks = input.blocks as ContentBlock[];
  const nextBody = serializeContentBlocksToMarkdown(blocks);
  const beforeBody = existing.body ?? "";

  if (nextBody === beforeBody) {
    return {
      success: false,
      error: "NO_CONTENT_CHANGE",
      message: "Serialized content matches current body.",
    };
  }

  const saveResult = await saveAdminArticle(existing.article, {
    expectedVersion: input.expectedVersion,
    actor: input.actor,
    body: nextBody,
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
    body: updated.body ?? nextBody,
    dependencyPaths,
  };
}
