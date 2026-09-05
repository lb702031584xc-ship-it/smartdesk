/**
 * Admin authentication configuration.
 * Credentials and allowlist come from environment variables — never committed.
 */

import type { EditorialWorkflowRole } from "@/types/editorial-workflow";
import { normalizeEnvValue } from "@/lib/env";

export function getAdminEmails(): string[] {
  const raw = normalizeEnvValue(process.env.ADMIN_EMAILS) ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Optional reviewer allowlist (Phase 36).
 * When empty, every admin email is both editor and reviewer (solo-operator mode).
 */
export function getAdminReviewerEmails(): string[] {
  const raw = normalizeEnvValue(process.env.ADMIN_REVIEWER_EMAILS) ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedAdminEmail(email: string): boolean {
  const allowed = getAdminEmails();
  if (allowed.length === 0) return false;
  return allowed.includes(email.trim().toLowerCase());
}

/**
 * Workflow roles derived from existing admin auth — no new auth system.
 * - Editor: any allowlisted admin
 * - Reviewer: ADMIN_REVIEWER_EMAILS when set; otherwise all admins
 */
export function getEditorialWorkflowRoles(email: string): EditorialWorkflowRole[] {
  if (!isAllowedAdminEmail(email)) return [];
  const roles: EditorialWorkflowRole[] = ["editor"];
  const reviewers = getAdminReviewerEmails();
  const normalized = email.trim().toLowerCase();
  if (reviewers.length === 0 || reviewers.includes(normalized)) {
    roles.push("reviewer");
  }
  return roles;
}

export function hasEditorialWorkflowRole(
  email: string,
  role: EditorialWorkflowRole,
): boolean {
  return getEditorialWorkflowRoles(email).includes(role);
}

export function isAuthConfigured(): boolean {
  return Boolean(
    normalizeEnvValue(process.env.AUTH_SECRET) &&
      normalizeEnvValue(process.env.ADMIN_PASSWORD_HASH) &&
      normalizeEnvValue(process.env.ADMIN_EMAILS),
  );
}
