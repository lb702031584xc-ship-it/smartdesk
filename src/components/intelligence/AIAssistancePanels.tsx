"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  acceptAIAssistanceAction,
  generateAIAssistanceAction,
  markAIAssistanceReviewedAction,
  rejectAIAssistanceAction,
} from "@/lib/admin/actions";
import { editorialWorkspaceHref } from "@/lib/editorial-workspace-links";
import type { AIContextViewModel } from "@/types/ai-context";
import type {
  AIAssistanceQueueViewModel,
  AIAssistanceType,
  AIAssistanceViewModel,
} from "@/types/ai-assistance";
import {
  IntelligenceEmptyState,
  IntelligenceSection,
  SignalBadge,
} from "@/components/intelligence/SignalBadge";

const TYPE_LABELS: Record<AIAssistanceType, string> = {
  seo: "SEO",
  "content-improvement": "Content improvement",
  "product-editorial": "Product editorial",
  "internal-link": "Internal link",
};

function statusTone(
  status: AIAssistanceViewModel["status"],
): "neutral" | "ok" | "warn" | "bad" {
  if (status === "accepted") return "ok";
  if (status === "rejected") return "bad";
  if (status === "reviewed") return "warn";
  return "neutral";
}

function AssistanceCard({
  item,
  showEntityLink,
}: {
  item: AIAssistanceViewModel;
  showEntityLink?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const open = item.status === "draft" || item.status === "reviewed";
  const href = editorialWorkspaceHref(item.entityType, item.entityId);

  function run(
    action: () => Promise<
      { success: true } | { success: false; error: string; message: string }
    >,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(`${result.error}: ${result.message}`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="rounded-md border border-[var(--line)] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-[var(--ink)]">
            {showEntityLink ? (
              <Link href={href} className="underline-offset-2 hover:underline">
                {item.entityName}
              </Link>
            ) : (
              item.entityName
            )}
          </p>
          <p className="text-xs text-[var(--subtle)]">
            {item.draft?.title ?? TYPE_LABELS[item.type]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SignalBadge label={TYPE_LABELS[item.type]} tone="neutral" />
          <SignalBadge label={item.status} tone={statusTone(item.status)} />
        </div>
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {item.draft?.body ?? item.output}
      </p>
      {item.suggestionId ? (
        <p className="mt-2 text-xs">
          <Link
            href="/dashboard/intelligence/ai"
            className="underline-offset-2 hover:underline"
          >
            Linked AI suggestion
          </Link>
          <span className="text-[var(--subtle)]">
            {" "}
            — accept still uses suggestion layer
          </span>
        </p>
      ) : null}
      {item.taskId ? (
        <p className="mt-2 text-xs">
          <Link
            href="/dashboard/editorial/tasks"
            className="underline-offset-2 hover:underline"
          >
            Linked editorial task
          </Link>
        </p>
      ) : null}
      {open ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.status === "draft" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => markAIAssistanceReviewedAction(item.id))}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--ink)] ring-1 ring-[var(--line)] disabled:opacity-50"
            >
              Mark reviewed
            </button>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => acceptAIAssistanceAction(item.id))}
            className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => rejectAIAssistanceAction(item.id))}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--ink)] ring-1 ring-[var(--line)] disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-900">{error}</p> : null}
    </li>
  );
}

export function AIContextSummaryPanel({
  context,
}: {
  context: AIContextViewModel | null;
}) {
  if (!context) {
    return (
      <IntelligenceSection title="AI context">
        <IntelligenceEmptyState message="No AI context for this entity." />
      </IntelligenceSection>
    );
  }

  return (
    <IntelligenceSection
      title="AI context"
      description="Derived snapshot for assistance. Canonical documents stay in Neon."
    >
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase text-[var(--subtle)]">Entity</dt>
          <dd className="text-[var(--ink)]">{context.entity.name}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-[var(--subtle)]">Topic</dt>
          <dd className="text-[var(--muted)]">
            {context.topic
              ? `${context.topic.topicId} · ${context.topic.articleCount} articles`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-[var(--subtle)]">
            Related products
          </dt>
          <dd className="text-[var(--muted)]">
            {context.relatedProducts.length
              ? context.relatedProducts.map((p) => p.name).join(", ")
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-[var(--subtle)]">
            Related articles
          </dt>
          <dd className="text-[var(--muted)]">
            {context.relatedArticles.length
              ? context.relatedArticles.map((a) => a.name).join(", ")
              : "—"}
          </dd>
        </div>
      </dl>
      {context.intelligenceSignals.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {context.intelligenceSignals.map((signal) => (
            <SignalBadge key={signal} label={signal} tone="warn" />
          ))}
        </div>
      ) : null}
    </IntelligenceSection>
  );
}

export function AIAssistanceEntityPanel({
  entityType,
  entityId,
  items,
}: {
  entityType: "product" | "article";
  entityId: string;
  items: AIAssistanceViewModel[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const types: AIAssistanceType[] =
    entityType === "article"
      ? ["seo", "content-improvement", "internal-link"]
      : ["product-editorial", "content-improvement"];

  function generate(type: AIAssistanceType) {
    setError(null);
    startTransition(async () => {
      const result = await generateAIAssistanceAction(
        entityType,
        entityId,
        type,
      );
      if (!result.success) {
        setError(`${result.error}: ${result.message}`);
        return;
      }
      router.refresh();
    });
  }

  const open = items.filter(
    (i) => i.status === "draft" || i.status === "reviewed",
  );
  const history = items.filter(
    (i) => i.status === "accepted" || i.status === "rejected",
  );

  return (
    <IntelligenceSection
      title="AI assistance"
      description="Drafts only. Accept creates a suggestion or task — never writes canonical content."
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {types.map((type) => (
          <button
            key={type}
            type="button"
            disabled={pending}
            onClick={() => generate(type)}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--ink)] ring-1 ring-[var(--line)] disabled:opacity-50"
          >
            Draft {TYPE_LABELS[type]}
          </button>
        ))}
      </div>
      {open.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No drafts pending review.</p>
      ) : (
        <ul className="space-y-3">
          {open.map((item) => (
            <AssistanceCard key={item.id} item={item} />
          ))}
        </ul>
      )}
      {history.length > 0 ? (
        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <p className="mb-2 text-xs font-medium uppercase text-[var(--subtle)]">
            History
          </p>
          <ul className="space-y-2 text-sm text-[var(--muted)]">
            {history.map((item) => (
              <li key={item.id}>
                {item.status} · {TYPE_LABELS[item.type]} ·{" "}
                {item.draft?.title ?? item.id.slice(0, 8)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-900">{error}</p> : null}
    </IntelligenceSection>
  );
}

export function AIAssistanceQueuePanel({
  queue,
}: {
  queue: AIAssistanceQueueViewModel;
}) {
  if (queue.items.length === 0) {
    return (
      <IntelligenceSection title="AI assistance">
        <IntelligenceEmptyState message="No AI assistance outputs yet." />
      </IntelligenceSection>
    );
  }

  return (
    <IntelligenceSection
      title="AI assistance"
      description={`${queue.pendingReview.length} pending review. Accept routes to suggestion or task.`}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <SignalBadge label={`Draft ${queue.draftCount}`} tone="neutral" />
        <SignalBadge label={`Reviewed ${queue.reviewedCount}`} tone="warn" />
        <SignalBadge label={`Accepted ${queue.acceptedCount}`} tone="ok" />
        <SignalBadge label={`Rejected ${queue.rejectedCount}`} tone="bad" />
      </div>
      {queue.pendingReview.length > 0 ? (
        <ul className="space-y-3">
          {queue.pendingReview.map((item) => (
            <AssistanceCard key={item.id} item={item} showEntityLink />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--muted)]">No pending reviews.</p>
      )}
      <div className="mt-6 border-t border-[var(--line)] pt-4">
        <p className="mb-2 text-xs font-medium uppercase text-[var(--subtle)]">
          Recent history
        </p>
        <ul className="space-y-2 text-sm text-[var(--muted)]">
          {queue.items
            .filter((i) => i.status === "accepted" || i.status === "rejected")
            .slice(0, 12)
            .map((item) => (
              <li key={item.id}>
                {item.status} · {item.entityName} · {TYPE_LABELS[item.type]}
              </li>
            ))}
        </ul>
      </div>
    </IntelligenceSection>
  );
}
