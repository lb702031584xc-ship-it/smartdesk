import React from "react";
import type { ContentOverviewViewModel } from "@/types/content-dashboard";
import { IntelligenceSection } from "@/components/intelligence/SignalBadge";

type ContentOverviewCardProps = {
  overview: ContentOverviewViewModel;
};

export function ContentOverviewCard({ overview }: ContentOverviewCardProps) {
  const items = [
    { label: "Articles", value: overview.totalArticles },
    { label: "Published", value: overview.publishedArticles },
    { label: "Products", value: overview.totalProducts },
    { label: "Topics", value: overview.totalTopics },
  ];

  return (
    <IntelligenceSection
      title="Content Overview"
      description="Corpus totals from the Content Intelligence read model."
    >
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-md border border-[var(--line)] bg-[var(--canvas)] px-4 py-3"
          >
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">
              {item.label}
            </dt>
            <dd className="mt-1 text-2xl font-semibold text-[var(--ink)]">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </IntelligenceSection>
  );
}
