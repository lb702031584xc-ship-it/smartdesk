import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "@/lib/db/client";
import { articles, articleRevisions, products, productRevisions } from "@/lib/db/schema";
import { isDatabaseContentStore } from "@/lib/content/store-config";
import { validateSnapshot } from "./validate-snapshot";
import {
  BACKUP_FORMAT_VERSION,
  type ArticleExportRecord,
  type ArticleRevisionExportItem,
  type BackupManifest,
  type ProductExportRecord,
  type ProductRevisionExportItem,
} from "./types";
import { randomUUID } from "node:crypto";

export type RestoreOptions = {
  snapshotPath: string;
  dryRun?: boolean;
  replace?: boolean;
};

export type RestoreResult = {
  ok: boolean;
  dryRun: boolean;
  articlesRestored: number;
  productsRestored: number;
  articleRevisionsRestored: number;
  productRevisionsRestored: number;
  error?: string;
};

export async function restoreContentSnapshot(options: RestoreOptions): Promise<RestoreResult> {
  const { snapshotPath, dryRun = false, replace = false } = options;

  if (!isDatabaseContentStore()) {
    return {
      ok: false,
      dryRun,
      articlesRestored: 0,
      productsRestored: 0,
      articleRevisionsRestored: 0,
      productRevisionsRestored: 0,
      error: "Restore requires CONTENT_STORE=database.",
    };
  }

  const validation = validateSnapshot(snapshotPath);
  if (!validation.valid) {
    return {
      ok: false,
      dryRun,
      articlesRestored: 0,
      productsRestored: 0,
      articleRevisionsRestored: 0,
      productRevisionsRestored: 0,
      error: `Snapshot validation failed: ${validation.errors.join("; ")}`,
    };
  }

  const manifest: BackupManifest = JSON.parse(
    readFileSync(join(snapshotPath, "manifest.json"), "utf8"),
  );

  if (manifest.formatVersion !== BACKUP_FORMAT_VERSION) {
    return {
      ok: false,
      dryRun,
      articlesRestored: 0,
      productsRestored: 0,
      articleRevisionsRestored: 0,
      productRevisionsRestored: 0,
      error: `Unsupported formatVersion: ${manifest.formatVersion}`,
    };
  }

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      articlesRestored: validation.articleCount,
      productsRestored: validation.productCount,
      articleRevisionsRestored: validation.articleRevisionCount,
      productRevisionsRestored: validation.productRevisionCount,
    };
  }

  const db = await getDb();

  try {
    await db.transaction(async (tx) => {
      // Check for existing data
      const existingArticles = await tx.select({ id: articles.id }).from(articles);
      const existingProducts = await tx.select({ id: products.id }).from(products);

      if (!replace && (existingArticles.length > 0 || existingProducts.length > 0)) {
        throw new Error(
          "Target database is not empty. Use --replace flag to overwrite existing content.",
        );
      }

      if (replace) {
        await tx.delete(articleRevisions);
        await tx.delete(productRevisions);
        await tx.delete(articles);
        await tx.delete(products);
      }

      // Restore products first (articles may reference them)
      const productFiles = manifest.files.filter(
        (f) => f.path.startsWith("products/") && f.path.endsWith(".json"),
      );
      for (const entry of productFiles) {
        const record: ProductExportRecord = JSON.parse(
          readFileSync(join(snapshotPath, entry.path), "utf8"),
        );
        await tx.insert(products).values({
          id: record.id,
          category: record.data.identity.category,
          data: record.data,
          version: record.version,
          dbUpdatedAt: new Date(),
        });
      }

      // Restore articles
      const articleFiles = manifest.files.filter(
        (f) => f.path.startsWith("articles/") && f.path.endsWith(".json"),
      );
      for (const entry of articleFiles) {
        const record: ArticleExportRecord = JSON.parse(
          readFileSync(join(snapshotPath, entry.path), "utf8"),
        );
        const slug = record.data.identity.slug;
        const bodyPath = `article-bodies/${slug}.md`;
        const bodyFile = manifest.files.find((f) => f.path === bodyPath);
        const body = bodyFile
          ? readFileSync(join(snapshotPath, bodyPath), "utf8")
          : "";

        await tx.insert(articles).values({
          id: record.id,
          slug,
          status: record.data.publishing.status,
          body,
          data: record.data,
          version: record.version,
          dbUpdatedAt: new Date(),
        });
      }

      // Restore article revisions
      const articleRevFiles = manifest.files.filter(
        (f) => f.path.startsWith("revisions/articles/"),
      );
      for (const entry of articleRevFiles) {
        const articleId = entry.path.replace("revisions/articles/", "").replace(".json", "");
        const items: ArticleRevisionExportItem[] = JSON.parse(
          readFileSync(join(snapshotPath, entry.path), "utf8"),
        );
        for (const item of items) {
          await tx.insert(articleRevisions).values({
            id: randomUUID(),
            articleId,
            revisionNumber: item.revisionNumber,
            data: item.data,
            body: item.body,
            sourceVersion: item.sourceVersion,
            createdAt: new Date(item.createdAt),
            createdBy: item.createdBy,
          });
        }
      }

      // Restore product revisions
      const productRevFiles = manifest.files.filter(
        (f) => f.path.startsWith("revisions/products/"),
      );
      for (const entry of productRevFiles) {
        const productId = entry.path.replace("revisions/products/", "").replace(".json", "");
        const items: ProductRevisionExportItem[] = JSON.parse(
          readFileSync(join(snapshotPath, entry.path), "utf8"),
        );
        for (const item of items) {
          await tx.insert(productRevisions).values({
            id: randomUUID(),
            productId,
            revisionNumber: item.revisionNumber,
            data: item.data,
            sourceVersion: item.sourceVersion,
            createdAt: new Date(item.createdAt),
            createdBy: item.createdBy,
          });
        }
      }
    });

    return {
      ok: true,
      dryRun: false,
      articlesRestored: validation.articleCount,
      productsRestored: validation.productCount,
      articleRevisionsRestored: validation.articleRevisionCount,
      productRevisionsRestored: validation.productRevisionCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      dryRun: false,
      articlesRestored: 0,
      productsRestored: 0,
      articleRevisionsRestored: 0,
      productRevisionsRestored: 0,
      error: message,
    };
  }
}
