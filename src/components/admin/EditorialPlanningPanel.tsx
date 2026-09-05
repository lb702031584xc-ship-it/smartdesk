"use client";

import { useState } from "react";
import Link from "next/link";
import type { CoverageInventory } from "@/lib/admin/editorial-coverage";
import type { EditorialOpportunity } from "@/lib/ai/planning-types";
import { analyzeEditorialOpportunitiesAction } from "@/lib/admin/actions";

type Tab = "coverage" | "opportunities";
type AIStatus = "idle" | "generating" | "ready" | "error";

export function EditorialPlanningPanel({
  inventory,
  productNames,
  articleTitles,
}: {
  inventory: CoverageInventory;
  productNames: Record<string, string>;
  articleTitles: Record<string, string>;
}) {
  const [tab, setTab] = useState<Tab>("coverage");
  const [aiStatus, setAIStatus] = useState<AIStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<EditorialOpportunity[]>([]);
  const [catalogGaps, setCatalogGaps] = useState<string[]>([]);

  async function runAnalysis() {
    setAIStatus("generating");
    setError(null);
    const result = await analyzeEditorialOpportunitiesAction();
    if (!result.ok) {
      setError(result.error);
      setAIStatus("error");
    } else {
      setOpportunities(result.opportunities);
      setCatalogGaps(result.catalogGaps);
      setAIStatus("ready");
      setTab("opportunities");
    }
  }

  return (
    <div>
      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Articles" value={inventory.articleCount} />
        <StatCard label="Products" value={inventory.productCount} />
        <StatCard label="Unused products" value={inventory.unusedProducts.length} />
        <StatCard label="Without review" value={inventory.productsWithoutReview.length} />
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <TabBtn active={tab === "coverage"} onClick={() => setTab("coverage")}>Coverage</TabBtn>
        <TabBtn active={tab === "opportunities"} onClick={() => setTab("opportunities")}>
          Opportunities {aiStatus === "ready" ? `(${opportunities.length})` : ""}
        </TabBtn>
      </div>

      {tab === "coverage" && (
        <CoverageView inventory={inventory} productNames={productNames} />
      )}

      {tab === "opportunities" && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <button
              type="button"
              disabled={aiStatus === "generating"}
              onClick={() => void runAnalysis()}
              className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {aiStatus === "generating" ? "Analyzing…" : aiStatus === "ready" ? "Regenerate" : "Analyze opportunities"}
            </button>
            {aiStatus === "idle" && (
              <p className="text-xs text-[var(--muted)]">Click to analyze content gaps with AI.</p>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          )}

          {catalogGaps.length > 0 && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-900">Catalog gaps</p>
              <ul className="mt-1 list-inside list-disc text-xs text-amber-800">
                {catalogGaps.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            </div>
          )}

          {opportunities.map((opp, i) => (
            <OpportunityCard
              key={i}
              opp={opp}
              productNames={productNames}
              articleTitles={articleTitles}
            />
          ))}

          {aiStatus === "ready" && opportunities.length === 0 && (
            <p className="text-sm text-[var(--muted)]">No content opportunities found.</p>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-white p-3 text-center">
      <p className="text-2xl font-bold text-[var(--ink)]">{value}</p>
      <p className="text-xs text-[var(--muted)]">{label}</p>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-[var(--ink)] text-white" : "bg-white text-[var(--ink)] ring-1 ring-[var(--line)] hover:bg-[var(--canvas)]"
      }`}
    >
      {children}
    </button>
  );
}

function CoverageView({ inventory, productNames }: { inventory: CoverageInventory; productNames: Record<string, string> }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-[var(--line)] bg-white p-3">
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">Articles by type</p>
          {Object.entries(inventory.articlesByType).map(([k, v]) => (
            <p key={k} className="text-xs">{k}: {v}</p>
          ))}
        </div>
        <div className="rounded-md border border-[var(--line)] bg-white p-3">
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">Articles by category</p>
          {Object.entries(inventory.articlesByCategory).map(([k, v]) => (
            <p key={k} className="text-xs">{k}: {v}</p>
          ))}
        </div>
        <div className="rounded-md border border-[var(--line)] bg-white p-3">
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">Products by category</p>
          {Object.entries(inventory.productsByCategory).map(([k, v]) => (
            <p key={k} className="text-xs">{k}: {v}</p>
          ))}
        </div>
        <div className="rounded-md border border-[var(--line)] bg-white p-3">
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">Articles by intent</p>
          {Object.entries(inventory.articlesByIntent).map(([k, v]) => (
            <p key={k} className="text-xs">{k}: {v}</p>
          ))}
        </div>
      </div>

      {inventory.unusedProducts.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="mb-1 text-xs font-semibold text-amber-900">Products with 0 article references</p>
          {inventory.unusedProducts.map((p) => (
            <p key={p.id} className="text-xs text-amber-800">{productNames[p.id] ?? p.id} ({p.category})</p>
          ))}
        </div>
      )}

      {inventory.productsWithoutReview.length > 0 && (
        <div className="rounded-md border border-[var(--line)] bg-white p-3">
          <p className="mb-1 text-xs font-semibold text-[var(--muted)]">Products without dedicated review</p>
          {inventory.productsWithoutReview.map((p) => (
            <p key={p.id} className="text-xs">{productNames[p.id] ?? p.id} ({p.category})</p>
          ))}
        </div>
      )}
    </div>
  );
}

function OpportunityCard({
  opp,
  productNames,
  articleTitles,
}: {
  opp: EditorialOpportunity;
  productNames: Record<string, string>;
  articleTitles: Record<string, string>;
}) {
  const isCatalogGap = opp.opportunityType === "catalog-gap";

  const prefillParams = new URLSearchParams();
  prefillParams.set("ai_title", opp.title);
  prefillParams.set("ai_type", opp.articleType);
  prefillParams.set("ai_intent", opp.intent);
  if (opp.category) prefillParams.set("ai_category", opp.category);
  if (opp.primaryKeywordSuggestion) prefillParams.set("ai_keyword", opp.primaryKeywordSuggestion);
  if (opp.suggestedProductIds.length > 0) prefillParams.set("ai_products", opp.suggestedProductIds.join(","));

  const priorityColors = {
    high: "bg-red-100 text-red-800",
    medium: "bg-amber-100 text-amber-800",
    low: "bg-green-100 text-green-800",
  };

  return (
    <div className="mb-3 rounded-md border border-[var(--line)] bg-white p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-[var(--ink)]">{opp.title}</h4>
        <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${priorityColors[opp.priority]}`}>
          {opp.priority}
        </span>
      </div>
      <div className="mb-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
        <span className="rounded bg-[var(--canvas)] px-1.5 py-0.5">{opp.articleType}</span>
        <span className="rounded bg-[var(--canvas)] px-1.5 py-0.5">{opp.intent}</span>
        <span className="rounded bg-[var(--canvas)] px-1.5 py-0.5">{opp.opportunityType}</span>
        {opp.category && <span className="rounded bg-[var(--canvas)] px-1.5 py-0.5">{opp.category}</span>}
      </div>
      <p className="mb-1 text-xs text-[var(--ink)]">{opp.rationale}</p>
      <p className="mb-2 text-xs text-[var(--subtle)]">Gap: {opp.coverageGap}</p>

      {opp.suggestedProductIds.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-medium text-[var(--muted)]">Suggested products:</p>
          <p className="text-xs">{opp.suggestedProductIds.map((id) => productNames[id] ?? id).join(", ")}</p>
        </div>
      )}

      {opp.relatedExistingArticleIds?.length ? (
        <div className="mb-2">
          <p className="text-xs font-medium text-[var(--muted)]">Related existing:</p>
          <p className="text-xs">{opp.relatedExistingArticleIds.map((id) => articleTitles[id] ?? id).join(", ")}</p>
        </div>
      ) : null}

      {opp.primaryKeywordSuggestion && (
        <p className="mb-2 text-xs text-[var(--subtle)]">Keyword: {opp.primaryKeywordSuggestion}</p>
      )}

      {isCatalogGap ? (
        <p className="text-xs text-amber-700">Catalog expansion needed first — no existing products support this topic.</p>
      ) : (
        <Link
          href={`/admin/articles/new?${prefillParams.toString()}`}
          className="inline-block rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
        >
          Start draft
        </Link>
      )}
    </div>
  );
}
