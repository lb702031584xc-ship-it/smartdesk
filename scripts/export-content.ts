/**
 * Export canonical content from Neon to a timestamped backup snapshot.
 * Usage: npm run export:content
 */
import { exportContentSnapshot } from "../src/lib/backup/export-content";
import { closeDb } from "../src/lib/db/client";

async function main() {
  console.log("[export] Starting content export...");
  const result = await exportContentSnapshot();

  if (!result.ok) {
    console.error(`[export] FAILED: ${result.error}`);
    process.exit(1);
  }

  console.log(`[export] Snapshot: ${result.snapshotPath}`);
  console.log(`[export] Articles: ${result.articleCount}`);
  console.log(`[export] Products: ${result.productCount}`);
  console.log(`[export] Article revisions: ${result.articleRevisionCount}`);
  console.log(`[export] Product revisions: ${result.productRevisionCount}`);
  console.log("[export] Done.");

  await closeDb();
}

main().catch(async (error) => {
  console.error("[export] Fatal:", error);
  await closeDb().catch(() => undefined);
  process.exit(2);
});
