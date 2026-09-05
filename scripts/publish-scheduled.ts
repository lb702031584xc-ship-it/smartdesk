/**
 * Manual scheduled publishing worker.
 * Usage: npm run publish:scheduled
 *
 * Requires CONTENT_STORE=database and DATABASE_URL.
 */

import { publishDueArticles } from "../src/lib/admin/publish-scheduled";

const noopRevalidate = async (paths: string[]) => ({
  attempted: paths.length > 0,
  ok: true,
  paths,
} as const);

async function main() {
  console.log("[publish-scheduled] Starting manual worker run...");

  const result = await publishDueArticles({
    revalidate: noopRevalidate,
  });

  console.log(`  checked:   ${result.checked}`);
  console.log(`  due:       ${result.due}`);
  console.log(`  published: ${result.published}`);
  console.log(`  skipped:   ${result.skipped}`);
  console.log(`  failed:    ${result.failed.length}`);

  for (const f of result.failed) {
    console.log(`    FAIL ${f.id}: ${f.reason}`);
  }
  for (const w of result.revalidationWarnings) {
    console.log(`    WARN ${w.id}: ${w.message}`);
  }

  console.log("[publish-scheduled] Done.");
  process.exit(result.failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("[publish-scheduled] Fatal:", error);
  process.exit(2);
});
