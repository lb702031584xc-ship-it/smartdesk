import { isDatabaseContentStore } from "@/lib/content/store-config";
import type { AdminWriteMode } from "./types";

/**
 * Filesystem writes: local development only.
 * Database writes: when CONTENT_STORE=database + DATABASE_URL (auth-gated at action layer).
 */
export function getAdminWriteMode(): AdminWriteMode {
  if (isDatabaseContentStore()) {
    return "database";
  }
  return process.env.NODE_ENV === "development" ? "development" : "disabled";
}

export function isAdminWriteEnabled(): boolean {
  if (isDatabaseContentStore()) {
    return true;
  }
  return process.env.NODE_ENV === "development";
}

export function serializeJsonDocument(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}
