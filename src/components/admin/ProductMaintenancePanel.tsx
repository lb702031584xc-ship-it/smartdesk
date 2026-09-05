"use client";

import { useState } from "react";
import Link from "next/link";
import { loadProductMaintenanceQueueAction } from "@/lib/admin/actions";
import {
  COMMERCE_STALE_DAYS,
  type ProductMaintenanceCandidate,
  type ProductMaintenancePriority,
  type ProductMaintenanceQueue,
  type ProductMaintenanceReasonType,
} from "@/lib/editorial/product-maintenance";

const REASON_LABELS: Record<ProductMaintenanceReasonType, string> = {
  "missing-asin": "Missing ASIN",
  "search-url": "Search URL",
  "availability-unknown": "Availability unknown",
  "commerce-never-checked": "Never checked",
  "commerce-stale": "Commerce stale",
  "asin-url-mismatch": "ASIN/URL mismatch",
  "invalid-asin": "Invalid ASIN",
  "placeholder-asin": "Placeholder ASIN",
  "missing-primary-image": "Missing image",
  "missing-review-data": "Missing review data",
  "sparse-product-data": "Sparse data",
  "unreferenced-product": "Unreferenced",
  "high-impact-product": "High impact",
  "validation-blocker": "Validation blocker",
};

export function ProductMaintenancePanel() {
  const [queue, setQueue] = useState<ProductMaintenanceQueue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<ProductMaintenancePriority | "all">("all");
  const [reasonFilter, setReasonFilter] = useState<ProductMaintenanceReasonType | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [upgradeFilter, setUpgradeFilter] = useState(false);
  const [asinCleanupFilter, setAsinCleanupFilter] = useState<
    "all" | "placeholder" | "invalid" | "missing" | "valid" | "search-invalid" | "search-missing" | "ready-lookup"
  >("all");

  async function load() {
    setLoading(true);
    setError(null);
    const result = await loadProductMaintenanceQueueAction();
    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setQueue(result);
    setLoading(false);
  }

  if (!queue && !loading) {
    return (
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
        <p className="mb-3 text-sm text-[var(--muted)]">
          Derives Product maintenance signals from canonical ProductV1, Article references, and commerce health.
          Stale threshold: {COMMERCE_STALE_DAYS} days since lastChecked. Use ASIN cleanup filters for catalog commerce triage.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Load maintenance queue
        </button>
      </div>
    );
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">Analyzing Products…</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!queue) return null;

  const categories = [...new Set(queue.candidates.map((c) => c.category))];

  const filtered = queue.candidates.filter((c) => {
    if (priorityFilter !== "all" && c.priority !== priorityFilter) return false;
    if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
    if (reasonFilter !== "all" && !c.reasons.some((r) => r.type === reasonFilter)) return false;
    if (upgradeFilter && !c.evidence.commerce?.detailUrlSuggestionAvailable) return false;
    const status = c.evidence.commerce?.asinStatus;
    const urlIsSearch = c.reasons.some((r) => r.type === "search-url");
    if (asinCleanupFilter === "placeholder" && status !== "placeholder") return false;
    if (asinCleanupFilter === "invalid" && status !== "invalid") return false;
    if (asinCleanupFilter === "missing" && status !== "missing") return false;
    if (asinCleanupFilter === "valid" && status !== "valid") return false;
    if (asinCleanupFilter === "search-invalid" && !(urlIsSearch && (status === "invalid" || status === "placeholder"))) return false;
    if (asinCleanupFilter === "search-missing" && !(urlIsSearch && status === "missing")) return false;
    if (asinCleanupFilter === "ready-lookup" && !c.evidence.commerce?.readyForAmazonLookup) return false;
    return true;
  });

  const placeholderCount = queue.candidates.filter((c) => c.evidence.commerce?.asinStatus === "placeholder").length;
  const easyUpgradeCount = queue.candidates.filter(
    (c) => c.evidence.commerce?.detailUrlSuggestionAvailable,
  ).length;
  const readyLookupCount = queue.candidates.filter((c) => c.evidence.commerce?.readyForAmazonLookup).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-4 gap-3">
          <Stat label="High" value={queue.counts.high} tone="red" />
          <Stat label="Medium" value={queue.counts.medium} tone="amber" />
          <Stat label="Low" value={queue.counts.low} tone="gray" />
          <Stat label="Total" value={queue.counts.total} tone="blue" />
        </div>
        <button type="button" onClick={() => void load()} className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-50">
          Refresh signals
        </button>
      </div>

      {queue.counts.total === 0 ? (
        <div className="rounded-lg border border-[var(--line)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">No maintenance candidates — catalog looks healthy.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <FilterBtn label="All" active={priorityFilter === "all"} onClick={() => setPriorityFilter("all")} />
            {(["high", "medium", "low"] as ProductMaintenancePriority[]).map((p) => (
              <FilterBtn key={p} label={p} active={priorityFilter === p} onClick={() => setPriorityFilter(p)} />
            ))}
            <span className="mx-1 text-[var(--line)]">|</span>
            <FilterBtn label="All categories" active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")} />
            {categories.map((cat) => (
              <FilterBtn key={cat} label={cat} active={categoryFilter === cat} onClick={() => setCategoryFilter(cat)} />
            ))}
            <span className="mx-1 text-[var(--line)]">|</span>
            <FilterBtn label="All reasons" active={reasonFilter === "all"} onClick={() => setReasonFilter("all")} />
            {(Object.keys(REASON_LABELS) as ProductMaintenanceReasonType[]).slice(0, 6).map((r) => (
              <FilterBtn key={r} label={REASON_LABELS[r]} active={reasonFilter === r} onClick={() => setReasonFilter(r)} />
            ))}
            {easyUpgradeCount > 0 && (
              <>
                <span className="mx-1 text-[var(--line)]">|</span>
                <FilterBtn
                  label={`Detail URL ready (${easyUpgradeCount})`}
                  active={upgradeFilter}
                  onClick={() => setUpgradeFilter((v) => !v)}
                />
              </>
            )}
            <span className="mx-1 text-[var(--line)]">|</span>
            <FilterBtn label="ASIN: all" active={asinCleanupFilter === "all"} onClick={() => setAsinCleanupFilter("all")} />
            {placeholderCount > 0 && (
              <FilterBtn label={`Placeholder (${placeholderCount})`} active={asinCleanupFilter === "placeholder"} onClick={() => setAsinCleanupFilter("placeholder")} />
            )}
            <FilterBtn label="Missing ASIN" active={asinCleanupFilter === "missing"} onClick={() => setAsinCleanupFilter("missing")} />
            <FilterBtn label="Invalid ASIN" active={asinCleanupFilter === "invalid"} onClick={() => setAsinCleanupFilter("invalid")} />
            <FilterBtn label="Valid ASIN" active={asinCleanupFilter === "valid"} onClick={() => setAsinCleanupFilter("valid")} />
            <FilterBtn label="Search + invalid" active={asinCleanupFilter === "search-invalid"} onClick={() => setAsinCleanupFilter("search-invalid")} />
            <FilterBtn label="Search + missing" active={asinCleanupFilter === "search-missing"} onClick={() => setAsinCleanupFilter("search-missing")} />
            {readyLookupCount > 0 && (
              <FilterBtn label={`Amazon lookup (${readyLookupCount})`} active={asinCleanupFilter === "ready-lookup"} onClick={() => setAsinCleanupFilter("ready-lookup")} />
            )}
          </div>

          <div className="space-y-4">
            {filtered.map((c) => (
              <CandidateCard key={c.productId} candidate={c} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  const colors: Record<string, string> = {
    red: "border-red-200 bg-red-50",
    amber: "border-amber-200 bg-amber-50",
    gray: "border-gray-200 bg-gray-50",
    blue: "border-blue-200 bg-blue-50",
  };
  return (
    <div className={`rounded-lg border p-3 ${colors[tone]}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-[var(--muted)]">{label}</p>
    </div>
  );
}

function FilterBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-md px-2 py-1 text-xs ${active ? "bg-[var(--ink)] text-white" : "ring-1 ring-[var(--line)]"}`}>
      {label}
    </button>
  );
}

function CandidateCard({ candidate }: { candidate: ProductMaintenanceCandidate }) {
  const priorityColors = { high: "bg-red-100 text-red-800", medium: "bg-amber-100 text-amber-800", low: "bg-gray-100 text-gray-700" };
  const deps = candidate.evidence.dependencies;
  const publishedArticles = deps?.articles.filter((a) => a.status === "published") ?? [];
  const commerce = candidate.evidence.commerce;
  const triageLabel = commerce?.detailUrlSuggestionAvailable
    ? "Deterministic URL suggestion available"
    : commerce?.amazonLookupAvailable
      ? "Amazon lookup available"
      : candidate.reasons.some((r) => r.type === "placeholder-asin")
        ? "Placeholder ASIN — manual verification required"
        : candidate.reasons.some((r) => r.type === "invalid-asin")
          ? "ASIN needs review"
          : candidate.reasons.some((r) => r.type === "missing-asin")
            ? "ASIN missing"
            : null;

  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium uppercase ${priorityColors[candidate.priority]}`}>{candidate.priority}</span>
            <h3 className="text-sm font-semibold">{candidate.name}</h3>
          </div>
          <p className="text-xs text-[var(--muted)]">{candidate.productId} · {candidate.category}</p>
          {triageLabel && (
            <p className="mt-1 text-xs font-medium text-blue-800">{triageLabel}</p>
          )}
        </div>
        <Link href={`/admin/products/${candidate.productId}?from=maintenance`} className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
          Edit Product
        </Link>
      </div>

      <ul className="mt-3 space-y-1">
        {candidate.reasons.map((r) => (
          <li key={r.id} className="text-sm">
            <span className="font-medium">{REASON_LABELS[r.type]}:</span> {r.message}
          </li>
        ))}
        {candidate.evidence.commerce?.detailUrlSuggestionAvailable && (
          <li className="text-sm text-blue-800">
            <span className="font-medium">Detail URL suggestion available</span> — ASIN + search URL can be upgraded in Product editor
          </li>
        )}
        {candidate.evidence.commerce?.amazonLookupAvailable && !candidate.evidence.commerce?.detailUrlSuggestionAvailable && (
          <li className="text-sm text-emerald-800">
            <span className="font-medium">Amazon lookup available</span> — valid ASIN can be verified via PAAPI
          </li>
        )}
      </ul>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {candidate.evidence.commerce && (
          <Evidence title="Commerce">
            {candidate.evidence.commerce.asin && <p>ASIN: {candidate.evidence.commerce.asin}</p>}
            {candidate.evidence.commerce.availability && <p>Availability: {candidate.evidence.commerce.availability}</p>}
            {candidate.evidence.commerce.lastChecked && <p>Last checked: {candidate.evidence.commerce.lastChecked}</p>}
            {candidate.evidence.commerce.daysSinceChecked !== undefined && (
              <p>{candidate.evidence.commerce.daysSinceChecked} days ago</p>
            )}
          </Evidence>
        )}
        {candidate.evidence.catalog && (
          <Evidence title="Catalog">
            <p>Image: {candidate.evidence.catalog.hasPrimaryImage ? "yes" : "no"}</p>
            <p>Rating: {candidate.evidence.catalog.hasRating ? "yes" : "no"}</p>
            <p>Verdict: {candidate.evidence.catalog.hasVerdict ? "yes" : "no"}</p>
          </Evidence>
        )}
        {deps && (
          <Evidence title="Dependencies">
            <p>{deps.publishedRefs} published · {deps.totalRefs} total refs</p>
            <p>Best Lists: {deps.bestListRefs} · Reviews: {deps.reviewRefs} · Comparisons: {deps.comparisonRefs}</p>
          </Evidence>
        )}
      </div>

      {publishedArticles.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold text-[var(--muted)]">Affected published Articles</p>
          <div className="flex flex-wrap gap-2">
            {publishedArticles.map((a) => (
              <Link key={a.id} href={`/admin/articles/${a.id}?from=product-maintenance&productId=${candidate.productId}`} className="text-xs text-blue-700 hover:underline">
                {a.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Evidence({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-[var(--line)] p-2 text-xs text-[var(--muted)]">
      <p className="mb-1 font-semibold text-[var(--ink)]">{title}</p>
      {children}
    </div>
  );
}
