/**
 * Phase 16C — Backup validation
 * Tests: export, integrity, tamper detection, missing files, invalid data, revision preservation, no DB mutation
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { exportContentSnapshot } from "../src/lib/backup/export-content";
import { validateSnapshot } from "../src/lib/backup/validate-snapshot";
import { isDatabaseContentStore } from "../src/lib/content/store-config";
import { listAdminArticles, listAdminProducts } from "../src/lib/admin";
import { closeDb } from "../src/lib/db/client";

const TEMP_DIR = resolve(process.cwd(), "backups", ".test-validate-backup");

function fail(message: string): never {
  console.error(`[validate-backup] ${message}`);
  process.exit(1);
}

function assert(condition: boolean, message: string) {
  if (!condition) fail(message);
}

function cleanup() {
  if (existsSync(TEMP_DIR)) {
    rmSync(TEMP_DIR, { recursive: true, force: true });
  }
}

async function main() {
  if (!isDatabaseContentStore()) {
    fail("CONTENT_STORE=database is required.");
  }

  cleanup();

  const articlesBefore = await listAdminArticles();
  const productsBefore = await listAdminProducts();
  const artCountBefore = articlesBefore.length;
  const prodCountBefore = productsBefore.length;

  // --- Export test ---
  const result = await exportContentSnapshot({ outputDir: TEMP_DIR });
  assert(result.ok, `export failed: ${result.error}`);
  assert(result.articleCount === artCountBefore, `article count mismatch: ${result.articleCount} vs ${artCountBefore}`);
  assert(result.productCount === prodCountBefore, `product count mismatch: ${result.productCount} vs ${prodCountBefore}`);
  console.log("  OK  export succeeds");

  const snapshotPath = result.snapshotPath!;

  // --- Manifest validation ---
  const validation = validateSnapshot(snapshotPath);
  assert(validation.valid, `validation failed: ${validation.errors.join("; ")}`);
  assert(validation.articleCount === artCountBefore, "article count mismatch in validation");
  assert(validation.productCount === prodCountBefore, "product count mismatch in validation");
  console.log("  OK  manifest valid + counts correct");

  // --- Hash verification (implicit in validateSnapshot) ---
  console.log("  OK  hash verification passes");

  // --- Tamper detection ---
  const manifestRaw = readFileSync(join(snapshotPath, "manifest.json"), "utf8");
  const manifest = JSON.parse(manifestRaw);
  const firstProductFile = manifest.files.find((f: { path: string }) => f.path.startsWith("products/"));
  if (firstProductFile) {
    const filePath = join(snapshotPath, firstProductFile.path);
    const original = readFileSync(filePath, "utf8");
    writeFileSync(filePath, original.replace('"brand"', '"Brand"'), "utf8");
    const tampered = validateSnapshot(snapshotPath);
    assert(!tampered.valid, "tampered file should fail validation");
    assert(tampered.errors.some((e) => e.includes("Hash mismatch")), "should report hash mismatch");
    writeFileSync(filePath, original, "utf8");
  }
  console.log("  OK  tamper detection");

  // --- Missing file test ---
  const firstBodyFile = manifest.files.find((f: { path: string }) => f.path.startsWith("article-bodies/"));
  if (firstBodyFile) {
    const filePath = join(snapshotPath, firstBodyFile.path);
    const original = readFileSync(filePath, "utf8");
    rmSync(filePath);
    const missing = validateSnapshot(snapshotPath);
    assert(!missing.valid, "missing file should fail validation");
    assert(missing.errors.some((e) => e.includes("Missing file")), "should report missing file");
    writeFileSync(filePath, original, "utf8");
  }
  console.log("  OK  missing file detection");

  // --- Invalid canonical data test ---
  const firstArticleFile = manifest.files.find((f: { path: string }) => f.path.startsWith("articles/"));
  if (firstArticleFile) {
    const filePath = join(snapshotPath, firstArticleFile.path);
    const original = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(original);
    delete parsed.data.identity;
    const invalidContent = JSON.stringify(parsed, null, 2) + "\n";
    const invalidHash = createHash("sha256").update(invalidContent, "utf8").digest("hex");
    writeFileSync(filePath, invalidContent, "utf8");
    const entry = manifest.files.find((f: { path: string }) => f.path === firstArticleFile.path);
    const originalHash = entry.sha256;
    entry.sha256 = invalidHash;
    writeFileSync(join(snapshotPath, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
    const invalid = validateSnapshot(snapshotPath);
    assert(!invalid.valid, "invalid canonical data should fail");
    entry.sha256 = originalHash;
    writeFileSync(join(snapshotPath, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
    writeFileSync(filePath, original, "utf8");
  }
  console.log("  OK  invalid canonical data detection");

  // --- Revision preservation ---
  if (result.articleRevisionCount > 0) {
    const revFile = manifest.files.find((f: { path: string }) => f.path.startsWith("revisions/articles/"));
    if (revFile) {
      const content = JSON.parse(readFileSync(join(snapshotPath, revFile.path), "utf8"));
      assert(Array.isArray(content), "revisions should be array");
      assert(content.length > 0, "revisions array not empty");
      const first = content[0];
      assert(typeof first.revisionNumber === "number", "revision has revisionNumber");
      assert(typeof first.createdBy === "string", "revision has createdBy");
      assert(typeof first.createdAt === "string", "revision has createdAt");
      assert(typeof first.sourceVersion === "number", "revision has sourceVersion");
      assert("data" in first, "revision has data");
      assert("body" in first, "article revision has body");
    }
  }
  console.log("  OK  revision preservation");

  // --- No DB mutation ---
  const articlesAfter = await listAdminArticles();
  const productsAfter = await listAdminProducts();
  assert(articlesAfter.length === artCountBefore, "article count must not change");
  assert(productsAfter.length === prodCountBefore, "product count must not change");
  console.log("  OK  no DB mutation");

  // Cleanup
  cleanup();

  await closeDb();
  console.log(`\nAll backup validation tests passed.`);
}

main().catch(async (error) => {
  console.error(error);
  cleanup();
  await closeDb().catch(() => undefined);
  process.exit(1);
});
