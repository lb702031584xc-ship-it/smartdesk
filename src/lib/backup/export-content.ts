import { createHash } from "node:crypto";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { getDb } from "@/lib/db/client";
import { articles, articleRevisions, products, productRevisions } from "@/lib/db/schema";
import { validateArticleV1 } from "@/lib/article-schema";
import { validateProductV1 } from "@/lib/product-schema";
import { isDatabaseContentStore } from "@/lib/content/store-config";
import { asc } from "drizzle-orm";
import {
  BACKUP_FORMAT_VERSION,
  type ArticleExportRecord,
  type ArticleRevisionExportItem,
  type BackupFileEntry,
  type BackupManifest,
  type ExportResult,
  type ProductExportRecord,
  type ProductRevisionExportItem,
} from "./types";

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, null, 2) + "\n";
}

function safePath(segment: string): string {
  const safe = segment.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!safe || safe === "." || safe === "..") {
    throw new Error(`Unsafe path segment: ${segment}`);
  }
  return safe;
}

export async function exportContentSnapshot(options?: {
  outputDir?: string;
}): Promise<ExportResult> {
  if (!isDatabaseContentStore()) {
    return {
      ok: false,
      articleCount: 0,
      productCount: 0,
      articleRevisionCount: 0,
      productRevisionCount: 0,
      error: "Export requires CONTENT_STORE=database.",
    };
  }

  const db = await getDb();
  const now = new Date();
  const ts = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const snapshotName = `smartdesk-${ts}`;
  const baseDir = options?.outputDir ?? resolve(process.cwd(), "backups");
  const tmpDir = join(baseDir, `.tmp-${snapshotName}`);
  const finalDir = join(baseDir, snapshotName);

  if (existsSync(finalDir)) {
    return {
      ok: false,
      articleCount: 0,
      productCount: 0,
      articleRevisionCount: 0,
      productRevisionCount: 0,
      error: `Snapshot already exists: ${finalDir}`,
    };
  }

  try {
    // Single transaction for consistent snapshot
    const snapshot = await db.transaction(async (tx) => {
      const articleRows = await tx.select().from(articles);
      const productRows = await tx.select().from(products);
      const articleRevRows = await tx
        .select()
        .from(articleRevisions)
        .orderBy(asc(articleRevisions.articleId), asc(articleRevisions.revisionNumber));
      const productRevRows = await tx
        .select()
        .from(productRevisions)
        .orderBy(asc(productRevisions.productId), asc(productRevisions.revisionNumber));
      return { articleRows, productRows, articleRevRows, productRevRows };
    }, { isolationLevel: "repeatable read" });

    // Validate current articles
    const slugsSeen = new Set<string>();
    for (const row of snapshot.articleRows) {
      const v = validateArticleV1(row.data);
      if (!v.valid) {
        return {
          ok: false,
          articleCount: 0,
          productCount: 0,
          articleRevisionCount: 0,
          productRevisionCount: 0,
          error: `Article ${row.id} fails validation: ${v.errors.join("; ")}`,
        };
      }
      if (slugsSeen.has(row.slug)) {
        return {
          ok: false,
          articleCount: 0,
          productCount: 0,
          articleRevisionCount: 0,
          productRevisionCount: 0,
          error: `Duplicate slug: ${row.slug}`,
        };
      }
      slugsSeen.add(row.slug);
    }

    // Validate current products
    for (const row of snapshot.productRows) {
      const v = validateProductV1(row.data);
      if (!v.valid) {
        return {
          ok: false,
          articleCount: 0,
          productCount: 0,
          articleRevisionCount: 0,
          productRevisionCount: 0,
          error: `Product ${row.id} fails validation: ${v.errors.join("; ")}`,
        };
      }
    }

    // Orphan revision detection
    const articleIds = new Set(snapshot.articleRows.map((r) => r.id));
    const productIds = new Set(snapshot.productRows.map((r) => r.id));
    for (const rev of snapshot.articleRevRows) {
      if (!articleIds.has(rev.articleId)) {
        return {
          ok: false,
          articleCount: 0,
          productCount: 0,
          articleRevisionCount: 0,
          productRevisionCount: 0,
          error: `Orphan article revision: article_id=${rev.articleId}`,
        };
      }
    }
    for (const rev of snapshot.productRevRows) {
      if (!productIds.has(rev.productId)) {
        return {
          ok: false,
          articleCount: 0,
          productCount: 0,
          articleRevisionCount: 0,
          productRevisionCount: 0,
          error: `Orphan product revision: product_id=${rev.productId}`,
        };
      }
    }

    // Write to temp dir
    mkdirSync(join(tmpDir, "articles"), { recursive: true });
    mkdirSync(join(tmpDir, "article-bodies"), { recursive: true });
    mkdirSync(join(tmpDir, "products"), { recursive: true });
    mkdirSync(join(tmpDir, "revisions", "articles"), { recursive: true });
    mkdirSync(join(tmpDir, "revisions", "products"), { recursive: true });

    const fileEntries: BackupFileEntry[] = [];

    for (const row of snapshot.articleRows) {
      const record: ArticleExportRecord = {
        id: row.id,
        version: row.version,
        data: row.data,
      };
      const content = stableJson(record);
      const relPath = `articles/${safePath(row.id)}.json`;
      writeFileSync(join(tmpDir, relPath), content, "utf8");
      fileEntries.push({ path: relPath, sha256: sha256(content) });

      const bodyRelPath = `article-bodies/${safePath(row.slug)}.md`;
      writeFileSync(join(tmpDir, bodyRelPath), row.body, "utf8");
      fileEntries.push({ path: bodyRelPath, sha256: sha256(row.body) });
    }

    for (const row of snapshot.productRows) {
      const record: ProductExportRecord = {
        id: row.id,
        version: row.version,
        data: row.data,
      };
      const content = stableJson(record);
      const relPath = `products/${safePath(row.id)}.json`;
      writeFileSync(join(tmpDir, relPath), content, "utf8");
      fileEntries.push({ path: relPath, sha256: sha256(content) });
    }

    // Group revisions by record
    const articleRevsByArticle = new Map<string, ArticleRevisionExportItem[]>();
    for (const rev of snapshot.articleRevRows) {
      const items = articleRevsByArticle.get(rev.articleId) ?? [];
      items.push({
        revisionNumber: rev.revisionNumber,
        sourceVersion: rev.sourceVersion,
        createdAt: rev.createdAt.toISOString(),
        createdBy: rev.createdBy,
        data: rev.data,
        body: rev.body,
      });
      articleRevsByArticle.set(rev.articleId, items);
    }
    for (const [articleId, items] of articleRevsByArticle) {
      const content = stableJson(items);
      const relPath = `revisions/articles/${safePath(articleId)}.json`;
      writeFileSync(join(tmpDir, relPath), content, "utf8");
      fileEntries.push({ path: relPath, sha256: sha256(content) });
    }

    const productRevsByProduct = new Map<string, ProductRevisionExportItem[]>();
    for (const rev of snapshot.productRevRows) {
      const items = productRevsByProduct.get(rev.productId) ?? [];
      items.push({
        revisionNumber: rev.revisionNumber,
        sourceVersion: rev.sourceVersion,
        createdAt: rev.createdAt.toISOString(),
        createdBy: rev.createdBy,
        data: rev.data,
      });
      productRevsByProduct.set(rev.productId, items);
    }
    for (const [productId, items] of productRevsByProduct) {
      const content = stableJson(items);
      const relPath = `revisions/products/${safePath(productId)}.json`;
      writeFileSync(join(tmpDir, relPath), content, "utf8");
      fileEntries.push({ path: relPath, sha256: sha256(content) });
    }

    // Write manifest last
    const manifest: BackupManifest = {
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: now.toISOString(),
      articleCount: snapshot.articleRows.length,
      productCount: snapshot.productRows.length,
      articleRevisionCount: snapshot.articleRevRows.length,
      productRevisionCount: snapshot.productRevRows.length,
      source: "database",
      contentSchema: { article: 1, product: 1 },
      files: fileEntries,
    };
    writeFileSync(join(tmpDir, "manifest.json"), stableJson(manifest), "utf8");

    // Atomic rename
    renameSync(tmpDir, finalDir);

    return {
      ok: true,
      snapshotPath: finalDir,
      articleCount: snapshot.articleRows.length,
      productCount: snapshot.productRows.length,
      articleRevisionCount: snapshot.articleRevRows.length,
      productRevisionCount: snapshot.productRevRows.length,
    };
  } catch (error) {
    // Cleanup temp on failure
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      articleCount: 0,
      productCount: 0,
      articleRevisionCount: 0,
      productRevisionCount: 0,
      error: message,
    };
  }
}
