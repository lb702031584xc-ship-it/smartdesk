import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateArticleV1 } from "@/lib/article-schema";
import { validateProductV1 } from "@/lib/product-schema";
import {
  BACKUP_FORMAT_VERSION,
  type ArticleExportRecord,
  type BackupManifest,
  type ProductExportRecord,
} from "./types";

export type SnapshotValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  articleCount: number;
  productCount: number;
  articleRevisionCount: number;
  productRevisionCount: number;
};

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function validateSnapshot(snapshotPath: string): SnapshotValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let articleCount = 0;
  let productCount = 0;
  let articleRevisionCount = 0;
  let productRevisionCount = 0;

  const fail = (msg: string) => {
    errors.push(msg);
    return { valid: false, errors, warnings, articleCount, productCount, articleRevisionCount, productRevisionCount };
  };

  const manifestPath = join(snapshotPath, "manifest.json");
  if (!existsSync(manifestPath)) {
    return fail("manifest.json not found.");
  }

  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return fail("manifest.json is not valid JSON.");
  }

  if (manifest.formatVersion !== BACKUP_FORMAT_VERSION) {
    return fail(`Unsupported formatVersion: ${manifest.formatVersion}`);
  }

  // Verify all files listed in manifest exist and hashes match
  for (const entry of manifest.files) {
    const filePath = join(snapshotPath, entry.path);
    if (!existsSync(filePath)) {
      return fail(`Missing file: ${entry.path}`);
    }
    const content = readFileSync(filePath, "utf8");
    const hash = sha256(content);
    if (hash !== entry.sha256) {
      return fail(`Hash mismatch for ${entry.path}`);
    }
  }

  // Validate article records
  const articleFiles = manifest.files.filter((f) => f.path.startsWith("articles/") && f.path.endsWith(".json"));
  const articleIds = new Set<string>();
  for (const entry of articleFiles) {
    const content = readFileSync(join(snapshotPath, entry.path), "utf8");
    let record: ArticleExportRecord;
    try {
      record = JSON.parse(content);
    } catch {
      return fail(`Invalid JSON: ${entry.path}`);
    }
    if (articleIds.has(record.id)) {
      return fail(`Duplicate article ID: ${record.id}`);
    }
    articleIds.add(record.id);
    const v = validateArticleV1(record.data);
    if (!v.valid) {
      return fail(`Article ${record.id} fails validation: ${v.errors.join("; ")}`);
    }
    articleCount++;
  }

  // Validate product records
  const productFiles = manifest.files.filter((f) => f.path.startsWith("products/") && f.path.endsWith(".json"));
  const productIds = new Set<string>();
  for (const entry of productFiles) {
    const content = readFileSync(join(snapshotPath, entry.path), "utf8");
    let record: ProductExportRecord;
    try {
      record = JSON.parse(content);
    } catch {
      return fail(`Invalid JSON: ${entry.path}`);
    }
    if (productIds.has(record.id)) {
      return fail(`Duplicate product ID: ${record.id}`);
    }
    productIds.add(record.id);
    const v = validateProductV1(record.data);
    if (!v.valid) {
      return fail(`Product ${record.id} fails validation: ${v.errors.join("; ")}`);
    }
    productCount++;
  }

  // Count revisions
  const articleRevFiles = manifest.files.filter((f) => f.path.startsWith("revisions/articles/"));
  for (const entry of articleRevFiles) {
    const content = readFileSync(join(snapshotPath, entry.path), "utf8");
    const items = JSON.parse(content) as unknown[];
    articleRevisionCount += items.length;
  }
  const productRevFiles = manifest.files.filter((f) => f.path.startsWith("revisions/products/"));
  for (const entry of productRevFiles) {
    const content = readFileSync(join(snapshotPath, entry.path), "utf8");
    const items = JSON.parse(content) as unknown[];
    productRevisionCount += items.length;
  }

  // Count verification
  if (articleCount !== manifest.articleCount) {
    return fail(`Article count mismatch: manifest=${manifest.articleCount}, actual=${articleCount}`);
  }
  if (productCount !== manifest.productCount) {
    return fail(`Product count mismatch: manifest=${manifest.productCount}, actual=${productCount}`);
  }
  if (articleRevisionCount !== manifest.articleRevisionCount) {
    return fail(`Article revision count mismatch: manifest=${manifest.articleRevisionCount}, actual=${articleRevisionCount}`);
  }
  if (productRevisionCount !== manifest.productRevisionCount) {
    return fail(`Product revision count mismatch: manifest=${manifest.productRevisionCount}, actual=${productRevisionCount}`);
  }

  return { valid: true, errors, warnings, articleCount, productCount, articleRevisionCount, productRevisionCount };
}
