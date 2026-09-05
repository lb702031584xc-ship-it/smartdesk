import React from "react";
import type { ContentOverviewViewModel } from "@/types/content-dashboard";
import {
  IntelligenceSection,
  SignalBadge,
} from "@/components/intelligence/SignalBadge";

type CommerceSignalsCardProps = {
  overview: ContentOverviewViewModel;
};

export function CommerceSignalsCard({ overview }: CommerceSignalsCardProps) {
  const { commercial } = overview;
  const rows = [
    {
      key: "productWithoutArticle",
      label: "Product without article",
      active: commercial.productWithoutArticle,
      count: commercial.productWithoutArticleIds.length,
    },
    {
      key: "articleWithoutProduct",
      label: "Article without product",
      active: commercial.articleWithoutProduct,
      count: commercial.articleWithoutProductIds.length,
    },
    {
      key: "highIntentWithoutCoverage",
      label: "High intent without coverage",
      active: commercial.highIntentWithoutCoverage,
      count: commercial.highIntentWithoutCoverageIds.length,
    },
  ] as const;

  return (
    <IntelligenceSection
      title="Commerce Signals"
      description="Read-only flags from Content Intelligence. No actions."
    >
      <ul className="space-y-3">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--line)] px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-[var(--ink)]">{row.label}</p>
              <p className="text-xs text-[var(--muted)]">
                {row.active ? `${row.count} item(s)` : "Clear"}
              </p>
            </div>
            <SignalBadge
              label={row.active ? "true" : "false"}
              tone={row.active ? "warn" : "ok"}
            />
          </li>
        ))}
      </ul>
    </IntelligenceSection>
  );
}
