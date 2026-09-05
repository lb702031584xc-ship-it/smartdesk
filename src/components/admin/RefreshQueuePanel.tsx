"use client";

import { useState } from "react";
import Link from "next/link";
import {
  loadRefreshQueueAction,
  suggestArticleRefreshPlanAction,
  type RefreshPlan,
} from "@/lib/admin/actions";
import type { RefreshCandidate, RefreshQueue, RefreshPriority, RefreshReasonType } from "@/lib/editorial/content-refresh";

const REASON_LABELS: Record<RefreshReasonType, string> = {
  "search-decline": "Search decline",
  "ctr-review": "CTR review",
  "position-opportunity": "Position opportunity",
  "internal-link-opportunity": "Internal link opportunity",
  "broken-internal-link": "Broken internal link",
  "orphan-article": "Orphan article",
  "dead-end-article": "Dead-end article",
  "readiness-warning": "Readiness warning",
  "content-verification-needed": "Verification needed",
};

export function RefreshQueuePanel() {
  const [queue, setQueue] = useState<RefreshQueue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<RefreshPriority | "all">("all");
  const [reasonFilter, setReasonFilter] = useState<RefreshReasonType | "all">("all");

  async function load(refreshSearch = false) {
    setLoading(true);
    setError(null);
    const result = await loadRefreshQueueAction({ refreshSearch });
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
          Aggregates signals from Publish Readiness, Content Graph, and Search Console (when configured).
          Signals resolve automatically when underlying issues are fixed.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Load refresh queue
        </button>
      </div>
    );
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">Calculating refresh candidates…</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!queue) return null;

  const filtered = queue.candidates.filter((c) => {
    if (priorityFilter !== "all" && c.priority !== priorityFilter) return false;
    if (reasonFilter !== "all" && !c.reasons.some((r) => r.type === reasonFilter)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-4 gap-3">
          <CountBadge label="High" value={queue.counts.high} color="red" />
          <CountBadge label="Medium" value={queue.counts.medium} color="amber" />
          <CountBadge label="Low" value={queue.counts.low} color="gray" />
          <CountBadge label="Total" value={queue.counts.total} color="blue" />
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
        >
          Refresh signals
        </button>
      </div>

      {!queue.gscAvailable && (
        <p className="text-xs text-[var(--muted)]">
          Search Console not configured or unavailable — queue uses Readiness and Content Graph only.
        </p>
      )}

      {queue.counts.total === 0 ? (
        <div className="rounded-lg border border-[var(--line)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">No refresh candidates right now. That can be valid.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <FilterBtn label="All priorities" active={priorityFilter === "all"} onClick={() => setPriorityFilter("all")} />
            {(["high", "medium", "low"] as RefreshPriority[]).map((p) => (
              <FilterBtn key={p} label={p} active={priorityFilter === p} onClick={() => setPriorityFilter(p)} />
            ))}
            <span className="mx-2 text-[var(--line)]">|</span>
            <FilterBtn label="All reasons" active={reasonFilter === "all"} onClick={() => setReasonFilter("all")} />
            {Object.entries(REASON_LABELS).map(([k, label]) => (
              <FilterBtn key={k} label={label} active={reasonFilter === k} onClick={() => setReasonFilter(k as RefreshReasonType)} />
            ))}
          </div>

          <div className="space-y-4">
            {filtered.map((c) => (
              <CandidateCard key={c.articleId} candidate={c} />
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-[var(--muted)]">No candidates match current filters.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CountBadge({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    red: "border-red-200 bg-red-50",
    amber: "border-amber-200 bg-amber-50",
    gray: "border-gray-200 bg-gray-50",
    blue: "border-blue-200 bg-blue-50",
  };
  return (
    <div className={`rounded-lg border p-3 ${colors[color]}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-[var(--muted)]">{label}</p>
    </div>
  );
}

function FilterBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-xs ${active ? "bg-[var(--ink)] text-white" : "ring-1 ring-[var(--line)]"}`}
    >
      {label}
    </button>
  );
}

function CandidateCard({ candidate }: { candidate: RefreshCandidate }) {
  const [plan, setPlan] = useState<RefreshPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const priorityColors = {
    high: "bg-red-100 text-red-800",
    medium: "bg-amber-100 text-amber-800",
    low: "bg-gray-100 text-gray-700",
  };

  async function requestPlan() {
    setPlanLoading(true);
    setPlanError(null);
    const result = await suggestArticleRefreshPlanAction(candidate);
    if (result.ok) setPlan(result.plan);
    else setPlanError(result.error);
    setPlanLoading(false);
  }

  const hasSearch = !!candidate.evidence.search;
  const hasGraph = !!candidate.evidence.graph;
  const hasReadiness = !!candidate.evidence.readiness;

  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium uppercase ${priorityColors[candidate.priority]}`}>
              {candidate.priority}
            </span>
            <h3 className="text-sm font-semibold">{candidate.title}</h3>
          </div>
          <p className="text-xs text-[var(--muted)]">
            {candidate.type}{candidate.category ? ` · ${candidate.category}` : ""} · {candidate.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/articles/${candidate.articleId}?from=refresh`}
            className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            Edit Article
          </Link>
          {candidate.suggestedActions.includes("add-internal-links") && (
            <Link href={`/admin/links`} className="rounded-md ring-1 ring-[var(--line)] px-3 py-1.5 text-xs hover:bg-gray-50">
              Review Links
            </Link>
          )}
          {hasSearch && (
            <Link href={`/admin/search`} className="rounded-md ring-1 ring-[var(--line)] px-3 py-1.5 text-xs hover:bg-gray-50">
              Search Data
            </Link>
          )}
        </div>
      </div>

      <ul className="mt-3 space-y-1">
        {candidate.reasons.map((r, i) => (
          <li key={i} className="text-sm">
            <span className="font-medium">{REASON_LABELS[r.type]}:</span> {r.message}
          </li>
        ))}
      </ul>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {hasSearch && candidate.evidence.search && (
          <EvidenceBlock title="Search">
            {candidate.evidence.search.impressions} imp · {candidate.evidence.search.clicks} clicks · CTR {(candidate.evidence.search.ctr * 100).toFixed(1)}% · Pos {candidate.evidence.search.position.toFixed(1)}
            {candidate.evidence.search.topQueries && candidate.evidence.search.topQueries.length > 0 && (
              <p className="mt-1 text-xs">Top: {candidate.evidence.search.topQueries.join(", ")}</p>
            )}
          </EvidenceBlock>
        )}
        {hasGraph && candidate.evidence.graph && (
          <EvidenceBlock title="Graph">
            Inbound: {candidate.evidence.graph.inboundLinks} · Outbound: {candidate.evidence.graph.outboundLinks}
            {candidate.evidence.graph.backlinkOpportunityCount > 0 && (
              <p className="mt-1">{candidate.evidence.graph.backlinkOpportunityCount} backlink opportunities</p>
            )}
            {candidate.evidence.graph.brokenLinks.length > 0 && (
              <p className="mt-1 text-red-700">Broken: {candidate.evidence.graph.brokenLinks.join(", ")}</p>
            )}
          </EvidenceBlock>
        )}
        {hasReadiness && candidate.evidence.readiness && (
          <EvidenceBlock title="Readiness">
            {candidate.evidence.readiness.blockers.length > 0 && (
              <p>{candidate.evidence.readiness.blockers.length} blocker(s)</p>
            )}
            {candidate.evidence.readiness.warnings.length > 0 && (
              <p>{candidate.evidence.readiness.warnings.length} warning(s)</p>
            )}
          </EvidenceBlock>
        )}
      </div>

      <button
        type="button"
        onClick={() => void requestPlan()}
        disabled={planLoading}
        className="mt-3 text-xs text-blue-700 hover:underline disabled:opacity-50"
      >
        {planLoading ? "Generating plan…" : "Suggest refresh plan (AI)"}
      </button>
      {planError && <p className="mt-1 text-xs text-red-700">{planError}</p>}
      {plan && (
        <div className="mt-2 rounded border border-blue-100 bg-blue-50 p-3 text-xs">
          <p className="font-medium">{plan.summary}</p>
          <ul className="mt-2 list-disc pl-4">
            {plan.actions.map((a, i) => (
              <li key={i}><strong>{a.area}:</strong> {a.recommendation} <span className="text-[var(--muted)]">({a.evidence})</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function EvidenceBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-[var(--line)] p-2 text-xs text-[var(--muted)]">
      <p className="mb-1 font-semibold text-[var(--ink)]">{title}</p>
      {children}
    </div>
  );
}
