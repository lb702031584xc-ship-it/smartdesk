/**
 * Pure editorial workspace link helpers (no server/DB imports).
 * Safe for client components.
 */
import type {
  EditorialWorkspaceLink,
} from "@/types/editorial-workspace";
import type { EditorialWorkflowEntityType } from "@/types/editorial-workflow";

export function buildEditorialWorkspaceLinks(
  entityType: EditorialWorkflowEntityType,
  entityId: string,
): EditorialWorkspaceLink[] {
  const base =
    entityType === "product"
      ? `/admin/products/${entityId}`
      : `/admin/articles/${entityId}`;

  return [
    {
      surface: "overview",
      label: "Workspace",
      href: `${base}/workspace`,
      description: "Unified editorial overview",
    },
    {
      surface: "edit",
      label: "Controlled edit",
      href: `${base}/edit`,
      description:
        entityType === "product"
          ? "Phase 34 editorial fields only"
          : "Phase 35 metadata and SEO only",
    },
    {
      surface: "workflow",
      label: "Workflow",
      href: `${base}/workflow`,
      description: "Review and publish control",
    },
    {
      surface: "history",
      label: "Revision history",
      href: `${base}/history`,
      description: "Before snapshots and diffs",
    },
    {
      surface: "record",
      label: "Full record",
      href: base,
      description: "Complete admin record view",
    },
  ];
}

export function editorialWorkspaceHref(
  entityType: EditorialWorkflowEntityType,
  entityId: string,
): string {
  const base =
    entityType === "product"
      ? `/admin/products/${entityId}`
      : `/admin/articles/${entityId}`;
  return `${base}/workspace`;
}
