import React from "react";
import type { ContentOverviewViewModel } from "@/types/content-dashboard";
import {
  IntelligenceEmptyState,
  IntelligenceSection,
} from "@/components/intelligence/SignalBadge";

type CoverageStatusCardProps = {
  overview: ContentOverviewViewModel;
};

export function CoverageStatusCard({ overview }: CoverageStatusCardProps) {
  const orphanCount = overview.orphanArticles.length;
  const missingProductContent = overview.productsWithoutContent.length;

  return (
    <IntelligenceSection
      title="Coverage Health"
      description="Structural gaps only — no automatic fixes."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-[var(--line)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">
            Orphan articles
          </p>
          <p className="mt-1 text-2xl font-semibold text-[var(--ink)]">{orphanCount}</p>
          {orphanCount === 0 ? (
            <div className="mt-3">
              <IntelligenceEmptyState message="No orphan articles detected." />
            </div>
          ) : (
            <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-sm text-[var(--muted)]">
              {overview.orphanArticles.map((a) => (
                <li key={a.articleId}>{a.title || a.articleId}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-md border border-[var(--line)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">
            Products without content
          </p>
          <p className="mt-1 text-2xl font-semibold text-[var(--ink)]">
            {missingProductContent}
          </p>
          {missingProductContent === 0 ? (
            <div className="mt-3">
              <IntelligenceEmptyState message="All products appear in at least one article." />
            </div>
          ) : (
            <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-sm text-[var(--muted)]">
              {overview.productsWithoutContent.map((p) => (
                <li key={p.productId}>{p.name || p.productId}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="mt-4 text-sm text-[var(--muted)]">
        Articles with products: {overview.articlesWithProducts} · without:{" "}
        {overview.articlesWithoutProducts}
      </p>
    </IntelligenceSection>
  );
}
