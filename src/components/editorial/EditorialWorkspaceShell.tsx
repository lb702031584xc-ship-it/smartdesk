"use client";

import React, { type ReactNode } from "react";
import Link from "next/link";
import type {
  EditorialWorkspaceLink,
  EditorialWorkspaceSurface,
} from "@/types/editorial-workspace";
import type { EditorialWorkflowEntityType } from "@/types/editorial-workflow";

type EditorialWorkspaceShellProps = {
  entityType: EditorialWorkflowEntityType;
  entityId: string;
  entityName: string;
  links: EditorialWorkspaceLink[];
  activeSurface: EditorialWorkspaceSurface;
  listHref: string;
  listLabel: string;
  children?: ReactNode;
};

/**
 * Entity-scoped navigation chrome for Phase 38 unified workspace.
 * Links only — no new mutation affordances.
 */
export function EditorialWorkspaceShell({
  entityType,
  entityId,
  entityName,
  links,
  activeSurface,
  listHref,
  listLabel,
  children,
}: EditorialWorkspaceShellProps) {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href={listHref}
          className="text-sm text-[var(--muted)] underline-offset-2 hover:underline"
        >
          ← {listLabel}
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">
              Editorial workspace · {entityType}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--ink)]">
              {entityName}
            </h1>
            <p className="mt-1 text-xs text-[var(--subtle)]">{entityId}</p>
          </div>
          <Link
            href="/dashboard/editorial"
            className="rounded-md px-3 py-1.5 text-sm text-[var(--muted)] ring-1 ring-[var(--line)] hover:bg-white"
          >
            All editorial ops
          </Link>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2 border-b border-[var(--line)] pb-4">
        {links.map((link) => {
          const active = link.surface === activeSurface;
          return (
            <Link
              key={link.surface}
              href={link.href}
              title={link.description}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-[var(--ink)] text-white"
                  : "bg-[var(--canvas)] text-[var(--ink)] ring-1 ring-[var(--line)] hover:bg-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
