import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { articles } from "@/lib/db/schema";
import { validateArticleV1 } from "@/lib/article-schema";
import { evaluateArticleReadiness } from "@/lib/editorial/article-readiness";
import { isDatabaseContentStore } from "@/lib/content/store-config";
import { clearArticleCache } from "@/lib/articles";
import { publishScheduledArticleWithRevision } from "@/lib/db/revisions";
import { SCHEDULED_PUBLISHER_ACTOR } from "./revision-constants";
import {
  collectArticleRevalidationPaths,
  type RevalidationOutcome,
} from "./revalidate-content";
import type { ArticleV1 } from "@/types/article-v1";

export type PublishScheduledResult = {
  checked: number;
  due: number;
  published: number;
  skipped: number;
  failed: { id: string; reason: string }[];
  revalidationWarnings: { id: string; message: string }[];
};

export type PublishScheduledOptions = {
  /** Override current time for testing. */
  now?: Date;
  /** Called to revalidate paths. Injected so the worker is testable without Next.js cache APIs. */
  revalidate?: (paths: string[]) => Promise<RevalidationOutcome>;
};

async function defaultRevalidate(paths: string[]): Promise<RevalidationOutcome> {
  if (paths.length === 0) return { attempted: false, ok: true, paths: [] };
  try {
    const { revalidatePath } = await import("next/cache");
    for (const p of paths) revalidatePath(p);
    return { attempted: true, ok: true, paths };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { attempted: true, ok: false, paths, error: message };
  }
}

export async function publishDueArticles(
  options?: PublishScheduledOptions,
): Promise<PublishScheduledResult> {
  if (!isDatabaseContentStore()) {
    throw new Error("Scheduled publishing requires CONTENT_STORE=database.");
  }

  const now = options?.now ?? new Date();
  const revalidate = options?.revalidate ?? defaultRevalidate;
  const nowIso = now.toISOString();

  const result: PublishScheduledResult = {
    checked: 0,
    due: 0,
    published: 0,
    skipped: 0,
    failed: [],
    revalidationWarnings: [],
  };

  const db = await getDb();

  const scheduledRows = await db
    .select()
    .from(articles)
    .where(eq(articles.status, "scheduled"));

  result.checked = scheduledRows.length;

  const dueRows = scheduledRows.filter((row) => {
    const data = row.data as ArticleV1;
    const scheduledAt = data.publishing?.scheduledAt;
    if (!scheduledAt) return false;
    return new Date(scheduledAt).getTime() <= now.getTime();
  });

  result.due = dueRows.length;

  for (const row of dueRows) {
    const article = row.data as ArticleV1;
    const id = row.id;

    const validation = validateArticleV1(article);
    if (!validation.valid) {
      result.failed.push({
        id,
        reason: `Validation failed: ${validation.errors.join("; ")}`,
      });
      continue;
    }

    const { listProductsV1 } = await import("@/lib/content/products");
    const { listArticlesV1 } = await import("@/lib/content/articles");
    const products = await listProductsV1();
    const allArticles = await listArticlesV1();
    const knownSlugs = new Set(allArticles.map((a) => a.identity.slug));
    const readiness = evaluateArticleReadiness(article, row.body, products, { knownSlugs });
    if (!readiness.ready) {
      result.failed.push({
        id,
        reason: `Readiness blockers: ${readiness.blockers.map((b) => b.message).join("; ")}`,
      });
      continue;
    }

    const updatedArticle: ArticleV1 = {
      ...article,
      publishing: {
        ...article.publishing,
        status: "published",
        publishedAt: article.publishing.publishedAt || nowIso,
      },
    };

    const publishResult = await publishScheduledArticleWithRevision({
      articleId: id,
      updatedArticle,
      now,
      actor: SCHEDULED_PUBLISHER_ACTOR,
    });

    if (publishResult === "skipped") {
      result.skipped += 1;
      continue;
    }

    result.published += 1;

    clearArticleCache();

    const paths = collectArticleRevalidationPaths({
      slug: article.identity.slug,
      previousStatus: "scheduled",
      nextStatus: "published",
      category: article.classification.category,
    });

    const revalOutcome = await revalidate(paths);
    if (revalOutcome.attempted && !revalOutcome.ok) {
      result.revalidationWarnings.push({
        id,
        message: `Published, but public refresh failed: ${revalOutcome.error ?? "unknown"}`,
      });
    }
  }

  return result;
}
