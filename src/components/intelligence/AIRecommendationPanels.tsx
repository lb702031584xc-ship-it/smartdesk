"use client";

import Link from "next/link";
import { editorialWorkspaceHref } from "@/lib/editorial-workspace-links";
import type {
  AIRecommendationPriority,
  AIRecommendationQueueViewModel,
  AIRecommendationType,
  AIRecommendationViewModel,
} from "@/types/ai-recommendation";
import type { EditorialWorkflowEntityType } from "@/types/editorial-workflow";
import {
  IntelligenceEmptyState,
  IntelligenceSection,
  SignalBadge,
} from "@/components/intelligence/SignalBadge";
import { CreateTaskFromRecommendationButton } from "@/components/editorial/EditorialTaskPanels";

const TYPE_LABELS: Record<AIRecommendationType, string> = {
  "content-coverage": "Content Coverage",
  "topic-expansion": "Topic Expansion",
  "seo-improvement": "SEO Improvement",
  "internal-linking": "Internal Linking",
};

function priorityTone(
  priority: AIRecommendationPriority,
): "bad" | "warn" | "neutral" {
  if (priority === "high") return "bad";
  if (priority === "medium") return "warn";
  return "neutral";
}

function entityHref(
  entityType: EditorialWorkflowEntityType | "topic",
  entityId: string,
): string | null {
  if (entityType === "topic") {
    return `/dashboard/intelligence/topics#${encodeURIComponent(entityId)}`;
  }
  return editorialWorkspaceHref(entityType, entityId);
}

function RecommendationCard({
  item,
  showEntityLink,
}: {
  item: AIRecommendationViewModel;
  showEntityLink?: boolean;
}) {
  const href = entityHref(item.entityType, item.entityId);

  return (
    <li className="rounded-md border border-[var(--line)] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-[var(--ink)]">
            {showEntityLink && href ? (
              <Link
                href={href}
                className="underline-offset-2 hover:underline"
              >
                {item.entityName}
              </Link>
            ) : (
              item.entityName
            )}
          </p>
          <p className="text-xs text-[var(--subtle)]">{item.title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SignalBadge
            label={item.priority.toUpperCase()}
            tone={priorityTone(item.priority)}
          />
          <SignalBadge label={`${item.priorityScore}`} tone="neutral" />
          <SignalBadge
            label={`${item.confidence}%`}
            tone={item.confidence >= 70 ? "ok" : "neutral"}
          />
          <SignalBadge
            label={TYPE_LABELS[item.recommendationType]}
            tone="neutral"
          />
        </div>
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase text-[var(--subtle)]">
            Reason
          </dt>
          <dd className="text-[var(--muted)]">{item.reason}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-[var(--subtle)]">
            Impact
          </dt>
          <dd className="text-[var(--ink)]">{item.impact}</dd>
        </div>
        {item.signals.length > 0 ? (
          <div>
            <dt className="text-xs font-medium uppercase text-[var(--subtle)]">
              Signals
            </dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {item.signals.map((signal) => (
                <SignalBadge
                  key={signal.label}
                  label={`${signal.label} (+${signal.weight})`}
                  tone="neutral"
                />
              ))}
            </dd>
          </div>
        ) : null}
      </dl>

      {item.suggestionId ? (
        <p className="mt-3 text-sm">
          <Link
            href="/dashboard/intelligence/ai"
            className="font-medium text-[var(--ink)] underline-offset-2 hover:underline"
          >
            Review linked AI suggestion
          </Link>
          <span className="text-[var(--subtle)]">
            {" "}
            — accept via suggestion layer only
          </span>
        </p>
      ) : null}

      <CreateTaskFromRecommendationButton recommendationId={item.id} />
    </li>
  );
}

function PriorityGroup({
  label,
  items,
}: {
  label: string;
  items: AIRecommendationViewModel[];
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--subtle)]">
        {label}
      </h3>
      <ul className="space-y-3">
        {items.map((item) => (
          <RecommendationCard key={item.id} item={item} showEntityLink />
        ))}
      </ul>
    </div>
  );
}

export function AIRecommendationQueuePanel({
  queue,
}: {
  queue: AIRecommendationQueueViewModel;
}) {
  if (queue.totalCount === 0) {
    return (
      <IntelligenceSection title="Operational Priority Queue">
        <IntelligenceEmptyState message="No open recommendations." />
      </IntelligenceSection>
    );
  }

  return (
    <IntelligenceSection
      title="Operational Priority Queue"
      description={`${queue.totalCount} recommendation(s). Read-only intelligence — no automatic actions.`}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <SignalBadge label={`High ${queue.highCount}`} tone="bad" />
        <SignalBadge label={`Medium ${queue.mediumCount}`} tone="warn" />
        <SignalBadge label={`Low ${queue.lowCount}`} tone="neutral" />
      </div>
      <div className="space-y-6">
        <PriorityGroup label="High priority" items={queue.byPriority.high} />
        <PriorityGroup label="Medium priority" items={queue.byPriority.medium} />
        <PriorityGroup label="Low priority" items={queue.byPriority.low} />
      </div>
    </IntelligenceSection>
  );
}

export function AIRecommendationEntityPanel({
  recommendations,
}: {
  recommendations: AIRecommendationViewModel[];
}) {
  if (recommendations.length === 0) {
    return (
      <IntelligenceSection title="Recommendations">
        <IntelligenceEmptyState message="No operational recommendations for this entity." />
      </IntelligenceSection>
    );
  }

  return (
    <IntelligenceSection
      title="Recommendations"
      description="Derived from content intelligence and AI signals. Review only — no direct mutations."
    >
      <ul className="space-y-3">
        {recommendations.map((item) => (
          <RecommendationCard key={item.id} item={item} />
        ))}
      </ul>
      <p className="mt-4 text-sm text-[var(--muted)]">
        <Link
          href="/dashboard/intelligence/recommendations"
          className="underline-offset-2 hover:underline"
        >
          View full priority queue
        </Link>
      </p>
    </IntelligenceSection>
  );
}
