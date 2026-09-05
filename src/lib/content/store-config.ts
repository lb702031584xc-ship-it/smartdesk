/**
 * Content persistence mode.
 *
 * filesystem (default): reads/writes JSON under content/ — suitable for CI build without DB.
 * database: canonical V1 in Postgres when DATABASE_URL is set.
 *
 * Production writes to the database require CONTENT_STORE=database + DATABASE_URL + auth.
 * Do not silently fall back to filesystem in production when database mode is requested.
 */

export type ContentStoreMode = "filesystem" | "database";

export function getContentStoreMode(): ContentStoreMode {
  const explicit = process.env.CONTENT_STORE?.trim().toLowerCase();
  if (explicit === "database" || explicit === "filesystem") {
    return explicit;
  }
  return "filesystem";
}

export function isDatabaseContentStore(): boolean {
  return getContentStoreMode() === "database" && Boolean(process.env.DATABASE_URL?.trim());
}

/**
 * Whether public/content reads should hit Neon.
 * During `next build` (SSG), prefer the repo filesystem so Vercel does not need a live DB
 * connection while collecting page data. Runtime still uses Neon when configured.
 */
export function preferDatabaseContentReads(): boolean {
  if (!isDatabaseContentStore()) return false;
  if (process.env.NEXT_PHASE === "phase-production-build") return false;
  return true;
}

export function requireDatabaseContentStore(): void {
  if (!isDatabaseContentStore()) {
    throw new Error(
      "[content] Database content store is not configured. Set CONTENT_STORE=database and DATABASE_URL.",
    );
  }
}
