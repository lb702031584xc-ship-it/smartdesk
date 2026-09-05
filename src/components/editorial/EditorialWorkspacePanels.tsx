import React from "react";
import Link from "next/link";
import type {
  EditorialWorkspaceLink,
  EditorialWorkspaceViewModel,
} from "@/types/editorial-workspace";
import {
  IntelligenceEmptyState,
  IntelligenceSection,
  SignalBadge,
} from "@/components/intelligence/SignalBadge";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function workflowTone(
  status: EditorialWorkspaceViewModel["workflowStatus"],
): "neutral" | "warn" | "ok" {
  if (status === "review") return "warn";
  if (status === "published" || status === "approved") return "ok";
  return "neutral";
}

export function WorkspaceStatusPanel({
  workspace,
}: {
  workspace: EditorialWorkspaceViewModel;
}) {
  return (
    <IntelligenceSection
      title="Operational status"
      description="Composed from workflow, revision, and version records. Read-only."
    >
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-[var(--line)] px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--subtle)]">
            Workflow
          </dt>
          <dd className="mt-2 flex items-center gap-2">
            <SignalBadge
              label={workspace.workflowStatus ?? "none"}
              tone={workflowTone(workspace.workflowStatus)}
            />
          </dd>
          {workspace.workflowUpdatedBy ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              {workspace.workflowUpdatedBy}
              {workspace.workflowUpdatedAt
                ? ` · ${formatWhen(workspace.workflowUpdatedAt)}`
                : ""}
            </p>
          ) : null}
        </div>
        <div className="rounded-md border border-[var(--line)] px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--subtle)]">
            Record version
          </dt>
          <dd className="mt-2 text-2xl font-semibold text-[var(--ink)]">
            {workspace.version ?? "—"}
          </dd>
        </div>
        <div className="rounded-md border border-[var(--line)] px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--subtle)]">
            Revisions
          </dt>
          <dd className="mt-2 text-2xl font-semibold text-[var(--ink)]">
            {workspace.revisionCount}
          </dd>
        </div>
        <div className="rounded-md border border-[var(--line)] px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--subtle)]">
            Intelligence
          </dt>
          <dd className="mt-2 space-y-1 text-sm">
            <Link
              href="/dashboard/intelligence/activity"
              className="block text-[var(--muted)] underline-offset-2 hover:underline"
            >
              Global activity
            </Link>
            <Link
              href="/dashboard/intelligence/changes"
              className="block text-[var(--muted)] underline-offset-2 hover:underline"
            >
              Global changes
            </Link>
          </dd>
        </div>
      </dl>
    </IntelligenceSection>
  );
}

export function WorkspaceLinksPanel({ links }: { links: EditorialWorkspaceLink[] }) {
  const actionable = links.filter((l) => l.surface !== "overview");
  return (
    <IntelligenceSection
      title="Controlled surfaces"
      description="Existing Phase 34–36 paths. Workspace does not expand permissions."
    >
      <ul className="grid gap-3 sm:grid-cols-2">
        {actionable.map((link) => (
          <li key={link.surface}>
            <Link
              href={link.href}
              className="block rounded-md border border-[var(--line)] px-4 py-3 hover:bg-[var(--canvas)]"
            >
              <p className="font-medium text-[var(--ink)]">{link.label}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{link.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </IntelligenceSection>
  );
}

export function WorkspaceActivityPanel({
  workspace,
}: {
  workspace: EditorialWorkspaceViewModel;
}) {
  if (workspace.recentActivity.length === 0) {
    return (
      <IntelligenceSection title="Entity activity">
        <IntelligenceEmptyState message="No revisions or workflow events for this entity yet." />
      </IntelligenceSection>
    );
  }

  return (
    <IntelligenceSection
      title="Entity activity"
      description="Revisions and workflow events for this record."
    >
      <ul className="space-y-2 text-sm">
        {workspace.recentActivity.map((item) => (
          <li
            key={item.id}
            className="rounded-md border border-[var(--line)] px-4 py-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-[var(--ink)]">
                {item.action.replace(/_/g, " ")}
              </span>
              <SignalBadge label={item.action.replace(/_/g, " ")} tone="neutral" />
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {item.actor} · {formatWhen(item.timestamp)}
              {item.workflowStatus ? ` · workflow: ${item.workflowStatus}` : ""}
            </p>
            {item.summary && item.summary.length > 0 ? (
              <p className="mt-1 text-xs text-[var(--subtle)]">
                {item.summary.join(" · ")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </IntelligenceSection>
  );
}

export function WorkspaceChangesPanel({
  workspace,
}: {
  workspace: EditorialWorkspaceViewModel;
}) {
  if (workspace.recentChanges.length === 0) {
    return (
      <IntelligenceSection title="Recent editorial changes">
        <IntelligenceEmptyState message="No allowlisted editorial/SEO field changes yet." />
      </IntelligenceSection>
    );
  }

  return (
    <IntelligenceSection
      title="Recent editorial changes"
      description="Phase 34/35 allowlisted fields only. Read-only."
    >
      <ul className="space-y-3">
        {workspace.recentChanges.map((change) => (
          <li
            key={change.id}
            className="rounded-md border border-[var(--line)] px-4 py-3 text-sm"
          >
            <p className="text-xs text-[var(--muted)]">
              {change.actor} · {formatWhen(change.timestamp)}
            </p>
            <dl className="mt-2 space-y-2">
              {change.diffs.map((diff) => (
                <div key={diff.field}>
                  <dt className="font-medium text-[var(--muted)]">{diff.field}</dt>
                  <dd className="text-[var(--ink)]">
                    <span className="text-[var(--subtle)]">Before:</span>{" "}
                    {diff.before ?? "—"}
                    <br />
                    <span className="text-[var(--subtle)]">After:</span>{" "}
                    {diff.after ?? "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </IntelligenceSection>
  );
}

export function WorkspaceIndexHeader() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--ink)]">
        Editorial Operations
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Unified operator view across workflow, mutations, revisions, and
        intelligence. Navigation only — editing stays on controlled paths.
      </p>
    </div>
  );
}
