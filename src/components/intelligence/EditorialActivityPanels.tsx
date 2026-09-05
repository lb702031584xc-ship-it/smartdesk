import React from "react";
import Link from "next/link";
import type {
  ChangeSummaryViewModel,
  EditorialActivityViewModel,
  ReviewQueueViewModel,
  StaleContentItemViewModel,
  PublishedChangeViewModel,
} from "@/types/editorial-activity";
import { editorialWorkspaceHref } from "@/lib/editorial-workspace-links";
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

export function ActivityFeed({
  items,
}: {
  items: EditorialActivityViewModel[];
}) {
  if (items.length === 0) {
    return (
      <IntelligenceSection title="Recent Activity">
        <IntelligenceEmptyState message="No editorial activity recorded yet." />
      </IntelligenceSection>
    );
  }

  return (
    <IntelligenceSection
      title="Recent Activity"
      description="Revisions and workflow events. Read-only."
    >
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-md border border-[var(--line)] px-4 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-[var(--ink)]">{item.entityName}</p>
                <p className="text-xs text-[var(--subtle)]">
                  {item.entityType} · {item.entityId}
                </p>
              </div>
              <SignalBadge label={item.action.replace(/_/g, " ")} tone="neutral" />
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {item.actor} · {formatWhen(item.timestamp)}
              {item.workflowStatus ? ` · workflow: ${item.workflowStatus}` : ""}
            </p>
            {item.summary && item.summary.length > 0 ? (
              <p className="mt-1 text-xs text-[var(--subtle)]">
                {item.summary.join(" · ")}
              </p>
            ) : null}
            <p className="mt-2 text-xs">
              <Link
                href={editorialWorkspaceHref(item.entityType, item.entityId)}
                className="text-[var(--muted)] underline-offset-2 hover:underline"
              >
                Open workspace
              </Link>
            </p>
          </li>
        ))}
      </ul>
    </IntelligenceSection>
  );
}

export function ReviewQueuePanel({ queue }: { queue: ReviewQueueViewModel }) {
  if (queue.pendingCount === 0) {
    return (
      <IntelligenceSection title="Pending Reviews">
        <IntelligenceEmptyState message="Nothing waiting for review." />
      </IntelligenceSection>
    );
  }

  return (
    <IntelligenceSection
      title="Pending Reviews"
      description={`${queue.pendingCount} item(s) in review status.`}
    >
      <ul className="space-y-3">
        {queue.items.map((item) => (
          <li
            key={`${item.entityType}:${item.entityId}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--line)] px-4 py-3"
          >
            <div>
              <p className="font-medium text-[var(--ink)]">{item.entityName}</p>
              <p className="text-xs text-[var(--muted)]">
                Submitted by {item.submittedBy} · {formatWhen(item.submittedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <SignalBadge label={item.currentStatus} tone="warn" />
              <Link
                href={editorialWorkspaceHref(item.entityType, item.entityId)}
                className="text-sm text-[var(--muted)] underline-offset-2 hover:underline"
              >
                Workspace
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </IntelligenceSection>
  );
}

export function ChangeSummaryList({
  changes,
}: {
  changes: ChangeSummaryViewModel[];
}) {
  if (changes.length === 0) {
    return (
      <IntelligenceSection title="Editorial Changes">
        <IntelligenceEmptyState message="No allowlisted editorial/SEO field changes in recent revisions." />
      </IntelligenceSection>
    );
  }

  return (
    <IntelligenceSection
      title="Editorial Changes"
      description="Before/after for Phase 34/35 allowlisted fields only."
    >
      <ul className="space-y-4">
        {changes.map((change) => (
          <li
            key={change.id}
            className="rounded-md border border-[var(--line)] px-4 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-[var(--ink)]">{change.entityName}</p>
                <p className="text-xs text-[var(--subtle)]">
                  {change.entityType} · {change.actor} ·{" "}
                  {formatWhen(change.timestamp)}
                </p>
              </div>
              <SignalBadge
                label={`${change.changedFields.length} field(s)`}
                tone="neutral"
              />
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              {change.diffs.map((diff) => (
                <div key={diff.field} className="grid gap-1 sm:grid-cols-[12rem_1fr]">
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

export function PublishedChangesPanel({
  items,
}: {
  items: PublishedChangeViewModel[];
}) {
  if (items.length === 0) {
    return (
      <IntelligenceSection title="Recently Published">
        <IntelligenceEmptyState message="No workflow publish events yet." />
      </IntelligenceSection>
    );
  }

  return (
    <IntelligenceSection title="Recently Published">
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li
            key={`${item.entityType}:${item.entityId}:${item.publishedAt}`}
            className="rounded-md border border-[var(--line)] px-4 py-2"
          >
            <span className="font-medium text-[var(--ink)]">{item.entityName}</span>
            <span className="text-[var(--muted)]">
              {" "}
              · {item.publishedBy} · {formatWhen(item.publishedAt)}
            </span>
          </li>
        ))}
      </ul>
    </IntelligenceSection>
  );
}

export function StaleContentPanel({
  items,
}: {
  items: StaleContentItemViewModel[];
}) {
  if (items.length === 0) {
    return (
      <IntelligenceSection title="Stale Published Articles">
        <IntelligenceEmptyState message="No published articles older than the stale threshold." />
      </IntelligenceSection>
    );
  }

  return (
    <IntelligenceSection
      title="Stale Published Articles"
      description="Published articles not updated in 90+ days (signal only)."
    >
      <ul className="space-y-2 text-sm">
        {items.slice(0, 20).map((item) => (
          <li
            key={item.entityId}
            className="flex flex-wrap justify-between gap-2 rounded-md border border-[var(--line)] px-4 py-2"
          >
            <span className="font-medium text-[var(--ink)]">{item.entityName}</span>
            <span className="text-[var(--muted)]">{item.daysSinceUpdate} days</span>
          </li>
        ))}
      </ul>
    </IntelligenceSection>
  );
}
