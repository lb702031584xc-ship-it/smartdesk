/**
 * Restore content from a backup snapshot into the configured database.
 * Usage: npm run restore:content -- <snapshot-path> [--dry-run] [--replace]
 */
import { restoreContentSnapshot } from "../src/lib/backup/restore-content";
import { closeDb } from "../src/lib/db/client";

async function main() {
  const args = process.argv.slice(2);
  const snapshotPath = args.find((a) => !a.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  const replace = args.includes("--replace");

  if (!snapshotPath) {
    console.error("Usage: npm run restore:content -- <snapshot-path> [--dry-run] [--replace]");
    process.exit(1);
  }

  console.log(`[restore] Snapshot: ${snapshotPath}`);
  console.log(`[restore] Mode: ${dryRun ? "dry-run" : replace ? "replace" : "empty-db"}`);

  const result = await restoreContentSnapshot({ snapshotPath, dryRun, replace });

  if (!result.ok) {
    console.error(`[restore] FAILED: ${result.error}`);
    process.exit(1);
  }

  if (result.dryRun) {
    console.log("[restore] Dry run — no changes made.");
  }
  console.log(`[restore] Articles: ${result.articlesRestored}`);
  console.log(`[restore] Products: ${result.productsRestored}`);
  console.log(`[restore] Article revisions: ${result.articleRevisionsRestored}`);
  console.log(`[restore] Product revisions: ${result.productRevisionsRestored}`);
  console.log("[restore] Done.");

  await closeDb();
}

main().catch(async (error) => {
  console.error("[restore] Fatal:", error);
  await closeDb().catch(() => undefined);
  process.exit(2);
});
