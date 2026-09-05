"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  acceptAISuggestionAction,
  rejectAISuggestionAction,
} from "@/lib/admin/actions";
import { editorialWorkspaceHref } from "@/lib/editorial-workspace-links";
import type {
  AISuggestionQueueViewModel,
  AISuggestionViewModel,
} from "@/types/ai-suggestion";
import {
  IntelligenceEmptyState,
  IntelligenceSection,
  SignalBadge,
} from "@/components/intelligence/SignalBadge";
import { CreateTaskFromSuggestionButton } from "@/components/editorial/EditorialTaskPanels";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function SuggestionCard({
  item,
  showEntityLink,
}: {
  item: AISuggestionViewModel;
  showEntityLink?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(item.status !== "pending");

  function run(
    action: () => Promise<
      | { success: true }
      | { success: false; error: string; message: string }
    >,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(`${result.error}: ${result.message}`);
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  return (
    <li className="rounded-md border border-[var(--line)] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-[var(--ink)]">
            {showEntityLink ? (
              <Link
                href={editorialWorkspaceHref(item.entityType, item.entityId)}
                className="underline-offset-2 hover:underline"
              >
                {item.entityName}
              </Link>
            ) : (
              item.entityName
            )}
          </p>
          <p className="text-xs text-[var(--subtle)]">
            {item.suggestionType} · {item.targetField}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SignalBadge
            label={`${item.confidence}%`}
            tone={item.confidence >= 70 ? "ok" : "neutral"}
          />
          <SignalBadge
            label={item.status}
            tone={
              item.status === "pending"
                ? "warn"
                : item.status === "accepted"
                  ? "ok"
                  : "neutral"
            }
          />
          {item.applyable ? (
            <SignalBadge label="applyable" tone="ok" />
          ) : (
            <SignalBadge label="advisory" tone="neutral" />
          )}
        </div>
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase text-[var(--subtle)]">
            Current
          </dt>
          <dd className="text-[var(--muted)]">{item.currentValue ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-[var(--subtle)]">
            Proposed
          </dt>
          <dd className="text-[var(--ink)]">{item.proposedValue}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-[var(--subtle)]">
            Reasoning
          </dt>
          <dd className="text-[var(--muted)]">{item.reasoning}</dd>
        </div>
      </dl>

      <p className="mt-2 text-xs text-[var(--subtle)]">
        {item.createdBy} · {formatWhen(item.createdAt)}
        {item.reviewedBy
          ? ` · reviewed by ${item.reviewedBy}`
          : ""}
        {item.mutationRevisionId
          ? ` · revision ${item.mutationRevisionId.slice(0, 8)}`
          : ""}
      </p>

      {!done && item.status === "pending" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => acceptAISuggestionAction(item.id))}
            className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => rejectAISuggestionAction(item.id))}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--ink)] ring-1 ring-[var(--line)] disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      ) : null}

      {item.status === "pending" ? (
        <CreateTaskFromSuggestionButton suggestionId={item.id} />
      ) : null}

      {error ? (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export function AISuggestionQueuePanel({
  queue,
}: {
  queue: AISuggestionQueueViewModel;
}) {
  if (queue.pendingCount === 0) {
    return (
      <IntelligenceSection title="Pending AI Suggestions">
        <IntelligenceEmptyState message="No pending AI suggestions." />
      </IntelligenceSection>
    );
  }

  return (
    <IntelligenceSection
      title="Pending AI Suggestions"
      description={`${queue.pendingCount} suggestion(s). Accept uses mutation boundaries; advisory items acknowledge only.`}
    >
      <ul className="space-y-3">
        {queue.items.map((item) => (
          <SuggestionCard key={item.id} item={item} showEntityLink />
        ))}
      </ul>
    </IntelligenceSection>
  );
}

export function AISuggestionEntityPanel({
  suggestions,
}: {
  suggestions: AISuggestionViewModel[];
}) {
  if (suggestions.length === 0) {
    return (
      <IntelligenceSection title="AI Suggestions">
        <IntelligenceEmptyState message="No AI suggestions for this entity." />
      </IntelligenceSection>
    );
  }

  const pending = suggestions.filter((s) => s.status === "pending");
  const history = suggestions.filter((s) => s.status !== "pending");

  return (
    <IntelligenceSection
      title="AI Suggestions"
      description="Decision support only. Accept routes through existing mutations and workflow locks."
    >
      {pending.length > 0 ? (
        <ul className="space-y-3">
          {pending.map((item) => (
            <SuggestionCard key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-[var(--muted)]">No pending suggestions.</p>
      )}
      {history.length > 0 ? (
        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--subtle)]">
            History (preserved)
          </p>
          <ul className="space-y-2 text-sm">
            {history.map((item) => (
              <li
                key={item.id}
                className="rounded-md border border-[var(--line)] px-3 py-2 text-[var(--muted)]"
              >
                <span className="font-medium text-[var(--ink)]">{item.status}</span>
                {" · "}
                {item.targetField}
                {" · "}
                {item.proposedValue.slice(0, 80)}
                {item.proposedValue.length > 80 ? "…" : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </IntelligenceSection>
  );
}
