import type { ArticleV1 } from "@/types/article-v1";
import type { ProductV1Document } from "@/types/product-v1";

export const BACKUP_FORMAT_VERSION = 1;

export type BackupManifest = {
  formatVersion: number;
  exportedAt: string;
  articleCount: number;
  productCount: number;
  articleRevisionCount: number;
  productRevisionCount: number;
  source: "database";
  contentSchema: {
    article: number;
    product: number;
  };
  files: BackupFileEntry[];
};

export type BackupFileEntry = {
  path: string;
  sha256: string;
};

export type ArticleExportRecord = {
  id: string;
  version: number;
  data: ArticleV1;
};

export type ProductExportRecord = {
  id: string;
  version: number;
  data: ProductV1Document;
};

export type ArticleRevisionExportItem = {
  revisionNumber: number;
  sourceVersion: number;
  createdAt: string;
  createdBy: string;
  data: ArticleV1;
  body: string;
};

export type ProductRevisionExportItem = {
  revisionNumber: number;
  sourceVersion: number;
  createdAt: string;
  createdBy: string;
  data: ProductV1Document;
};

export type ExportResult = {
  ok: boolean;
  snapshotPath?: string;
  articleCount: number;
  productCount: number;
  articleRevisionCount: number;
  productRevisionCount: number;
  error?: string;
};
