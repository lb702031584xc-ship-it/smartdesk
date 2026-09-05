/**
 * Phase 26 — Clear placeholder ASINs from canonical Product records (Neon).
 * Usage: npx tsx scripts/phase26-clear-placeholder-asins.ts [--dry-run]
 *
 * Only replaces ASIN when PHASE26_VERIFIED_ASINS JSON env supplies operator-verified values:
 *   PHASE26_VERIFIED_ASINS='{"flexispot-compact":"B0REALASIN1"}'
 */
import "./load-env-local";
import fs from "node:fs";
import path from "node:path";
import { listArticlesV1 } from "../src/lib/content/articles";
import { listProductsV1 } from "../src/lib/content/products";
import { getAdminProduct, saveAdminProduct } from "../src/lib/admin";
import { normalizeProductV1 } from "../src/lib/admin/normalize-product";
import { PHASE26_COMMERCE_CLEANUP_ACTOR } from "../src/lib/admin/revision-constants";
import { listProductRevisions } from "../src/lib/db/revisions";
import { classifyAsinStatus } from "../src/lib/commerce/asin";
import {
  auditProductCommerce,
  summarizeCatalogCommerceAudit,
} from "../src/lib/commerce/catalog-audit";
import { buildProductDependencies } from "../src/lib/editorial/product-maintenance";
import { isDatabaseContentStore } from "../src/lib/content/store-config";
import { closeDb } from "../src/lib/db/client";
import type { ProductV1Document } from "../src/types/product-v1";

const MANIFEST_PATH = path.join(
  process.cwd(),
  "content/migrations/product-commerce-cleanup.json",
);

type CleanupAction = "cleared" | "replaced" | "skipped";

type CleanupMapping = {
  productId: string;
  oldAsin: string;
  action: CleanupAction;
  newAsin: string | null;
  reason: string;
  source?: string;
  publishedRefs: number;
  revisionCreated: boolean;
};

function fail(message: string): never {
  console.error(`[phase26] ${message}`);
  process.exit(1);
}

function parseVerifiedAsins(): Record<string, string> {
  const raw = process.env.PHASE26_VERIFIED_ASINS?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(parsed).map(([id, asin]) => [id, asin.trim().toUpperCase()]),
    );
  } catch {
    fail("PHASE26_VERIFIED_ASINS is not valid JSON.");
  }
}

function stripCommerceAsin(product: ProductV1Document): ProductV1Document {
  const commerce = { ...(product.commerce ?? {}) };
  delete commerce.asin;
  return normalizeProductV1({
    ...product,
    commerce: Object.keys(commerce).length ? commerce : undefined,
  });
}

function withVerifiedAsin(product: ProductV1Document, asin: string): ProductV1Document {
  return normalizeProductV1({
    ...product,
    commerce: {
      ...(product.commerce ?? {}),
      asin,
    },
  });
}

function comparableProduct(product: ProductV1Document): ProductV1Document {
  const normalized = normalizeProductV1(product);
  const clone = structuredClone(normalized) as ProductV1Document;
  if (clone.commerce) {
    delete clone.commerce.asin;
    if (Object.keys(clone.commerce).length === 0) {
      delete clone.commerce;
    }
  }
  return clone;
}

function assertOnlyAsinChanged(before: ProductV1Document, after: ProductV1Document) {
  const beforeCmp = comparableProduct(before);
  const afterCmp = comparableProduct(after);
  if (JSON.stringify(beforeCmp) !== JSON.stringify(afterCmp)) {
    fail(`Product ${before.id}: non-ASIN fields changed during cleanup.`);
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!isDatabaseContentStore()) {
    fail("CONTENT_STORE=database is required for Phase 26 cleanup.");
  }

  const verifiedAsins = parseVerifiedAsins();
  const products = await listProductsV1();
  const articles = await listArticlesV1();
  const deps = buildProductDependencies(products, articles);

  const preRows = products.map((product) =>
    auditProductCommerce(product, {
      publishedRefs: deps.get(product.id)?.publishedRefs ?? 0,
      totalRefs: deps.get(product.id)?.totalRefs ?? 0,
    }),
  );
  const preAudit = summarizeCatalogCommerceAudit(preRows);

  console.log("=== Phase 26 Pre-Cleanup Audit ===");
  console.log(`Products: ${preAudit.productCount}`);
  console.log(`Articles: ${articles.length}`);
  console.log(`Placeholder ASIN: ${preAudit.placeholderAsin}`);
  console.log(`Valid ASIN: ${preAudit.validAsin}`);
  console.log(`Invalid ASIN: ${preAudit.invalidAsin}`);
  console.log(`Missing ASIN: ${preAudit.missingAsin}`);

  const placeholders = preAudit.products.filter((row) => row.asinStatus === "placeholder");
  if (placeholders.length === 0) {
    console.log("\nNo placeholder ASINs found — nothing to clean.");
    return;
  }

  console.log("\n=== Placeholder Products ===");
  for (const row of placeholders) {
    console.log(
      `${row.productId}: ${row.storedAsin} url=${row.urlType} refs=${row.publishedRefs}/${row.totalRefs} lastChecked=${row.lastChecked ?? "—"}`,
    );
  }

  const mappings: CleanupMapping[] = [];

  for (const row of placeholders) {
    const record = await getAdminProduct(row.productId);
    if (!record) fail(`Product not found: ${row.productId}`);

    const oldAsin = record.product.commerce?.asin?.trim();
    if (!oldAsin || classifyAsinStatus(oldAsin) !== "placeholder") {
      fail(`Product ${row.productId} is no longer a placeholder ASIN. Re-run audit.`);
    }

    const verified = verifiedAsins[row.productId];
    let updated: ProductV1Document;
    let action: CleanupAction;
    let newAsin: string | null;
    let reason: string;
    let source: string | undefined;

    if (verified) {
      updated = withVerifiedAsin(record.product, verified);
      action = "replaced";
      newAsin = verified;
      reason = "Operator-verified ASIN";
      source = "PHASE26_VERIFIED_ASINS";
    } else {
      updated = stripCommerceAsin(record.product);
      action = "cleared";
      newAsin = null;
      reason = "Known development placeholder; no verified replacement available";
    }

    assertOnlyAsinChanged(record.product, updated);

    if (dryRun) {
      mappings.push({
        productId: row.productId,
        oldAsin,
        action,
        newAsin,
        reason,
        source,
        publishedRefs: row.publishedRefs,
        revisionCreated: false,
      });
      console.log(`[dry-run] ${row.productId}: ${action} ${oldAsin} -> ${newAsin ?? "—"}`);
      continue;
    }

    const saveResult = await saveAdminProduct(updated, {
      expectedVersion: record.version,
      actor: PHASE26_COMMERCE_CLEANUP_ACTOR,
    });

    if (!saveResult.ok) {
      fail(
        `Failed to save ${row.productId}: ${saveResult.errors.join("; ") || saveResult.blockedReason || "unknown error"}`,
      );
    }

    const afterRecord = await getAdminProduct(row.productId);
    if (!afterRecord) fail(`Product missing after save: ${row.productId}`);

    const afterStatus = classifyAsinStatus(afterRecord.product.commerce?.asin);
    if (action === "cleared" && afterStatus !== "missing") {
      fail(`Product ${row.productId}: expected missing ASIN after clear, got ${afterStatus}.`);
    }
    if (action === "replaced" && afterRecord.product.commerce?.asin !== newAsin) {
      fail(`Product ${row.productId}: verified ASIN not persisted.`);
    }

    assertOnlyAsinChanged(record.product, afterRecord.product);

    const revisions = await listProductRevisions(row.productId);
    const latestRevision = revisions[0];
    const revisionHasPlaceholder =
      latestRevision &&
      classifyAsinStatus(latestRevision.data.commerce?.asin) === "placeholder";

    if (!saveResult.revisionCreated) {
      fail(`Product ${row.productId}: expected revision snapshot on cleanup save.`);
    }
    if (!revisionHasPlaceholder) {
      fail(`Product ${row.productId}: latest revision should preserve prior placeholder ASIN.`);
    }

    mappings.push({
      productId: row.productId,
      oldAsin,
      action,
      newAsin,
      reason,
      source,
      publishedRefs: row.publishedRefs,
      revisionCreated: Boolean(saveResult.revisionCreated),
    });

    console.log(
      `[saved] ${row.productId}: ${action} ${oldAsin} -> ${newAsin ?? "—"} refs=${row.publishedRefs} revision=${saveResult.revisionCreated ? "yes" : "no"} revalidated=${saveResult.revalidated ? "yes" : "no"}`,
    );
  }

  if (!dryRun) {
    const manifest = {
      _comment:
        "Operator-reviewed Product commerce cleanup mappings only. Do not add guessed ASINs.",
      phase: 26,
      executedAt: new Date().toISOString(),
      actor: PHASE26_COMMERCE_CLEANUP_ACTOR,
      mappings,
    };
    fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log(`\nManifest written: ${MANIFEST_PATH}`);
  }

  const postProducts = dryRun ? products : await listProductsV1();
  const postRows = postProducts.map((product) =>
    auditProductCommerce(product, {
      publishedRefs: deps.get(product.id)?.publishedRefs ?? 0,
      totalRefs: deps.get(product.id)?.totalRefs ?? 0,
    }),
  );

  if (!dryRun) {
    const liveAudit = summarizeCatalogCommerceAudit(postRows);
    console.log("\n=== Phase 26 Post-Cleanup Audit ===");
    console.log(`Placeholder ASIN: ${liveAudit.placeholderAsin}`);
    console.log(`Valid ASIN: ${liveAudit.validAsin}`);
    console.log(`Invalid ASIN: ${liveAudit.invalidAsin}`);
    console.log(`Missing ASIN: ${liveAudit.missingAsin}`);
    if (liveAudit.integrity.placeholderAsinFail || liveAudit.integrity.invalidAsinFail) {
      fail("Post-cleanup integrity check failed.");
    }
  }

  console.log("\n=== Cleanup Report ===");
  for (const mapping of mappings) {
    console.log(
      `${mapping.productId}\t${mapping.oldAsin}\t${mapping.action}\t${mapping.newAsin ?? "—"}\trefs=${mapping.publishedRefs}\trevision=${mapping.revisionCreated ? "yes" : "no"}`,
    );
  }

  if (dryRun) {
    console.log("\nDry run complete — no database changes made.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
