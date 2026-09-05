"use client";

import { useState } from "react";
import Link from "next/link";
import {
  loadSearchIntelligenceAction,
  analyzeSearchOpportunityAction,
  type SearchIntelligenceResult,
  type AISearchAnalysis,
} from "@/lib/admin/actions";
import type {
  SearchDateWindow,
  SearchIntelligenceData,
  ArticleSearchProfile,
  SearchOpportunity,
} from "@/lib/search-console/types";

type SortKey = "clicks" | "impressions" | "ctr" | "position" | "clickChange";

export function SearchPerformancePanel() {
  const [data, setData] = useState<SearchIntelligenceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [dateWindow, setDateWindow] = useState<SearchDateWindow>(28);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("impressions");
  const [sortAsc, setSortAsc] = useState(false);

  async function load(refresh = false) {
    setLoading(true);
    setError(null);
    const result: SearchIntelligenceResult = await loadSearchIntelligenceAction(dateWindow, { refresh });
    if (result.ok) {
      setData(result.data);
      setConfigured(true);
    } else {
      setConfigured(result.configured);
      setError(result.error);
      if (!result.configured) setData(null);
    }
    setLoading(false);
  }

  if (!data && !loading && !error) {
    return (
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
        <p className="mb-2 text-sm text-[var(--muted)]">
          Google Search Console data is delayed (typically 2–3 days). Metrics come directly from GSC — not real-time traffic.
        </p>
        <div className="mb-4 flex gap-2">
          {([7, 28, 90] as SearchDateWindow[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDateWindow(d)}
              className={`rounded-md px-3 py-1 text-sm ${dateWindow === d ? "bg-[var(--ink)] text-white" : "ring-1 ring-[var(--line)]"}`}
            >
              {d} days
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Load Search Console data
        </button>
      </div>
    );
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">Fetching Search Console data…</p>;

  if (error && !data) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <p className="text-sm text-amber-950">{error}</p>
        {!configured && (
          <p className="mt-2 text-xs text-amber-800">
            Set GSC_PROPERTY, GSC_CLIENT_EMAIL, and GSC_PRIVATE_KEY in environment variables.
          </p>
        )}
        {configured && (
          <button type="button" onClick={() => void load(true)} className="mt-3 text-sm underline">
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!data) return null;

  const { overview, articles, unmappedPages } = data;
  const sorted = [...articles].sort((a, b) => {
    let av: number, bv: number;
    switch (sortKey) {
      case "clicks": av = a.current.clicks; bv = b.current.clicks; break;
      case "impressions": av = a.current.impressions; bv = b.current.impressions; break;
      case "ctr": av = a.current.ctr; bv = b.current.ctr; break;
      case "position": av = a.current.position; bv = b.current.position; break;
      case "clickChange": av = a.clickChange ?? 0; bv = b.clickChange ?? 0; break;
      default: av = 0; bv = 0;
    }
    return sortAsc ? av - bv : bv - av;
  });

  const selected = selectedArticle ? articles.find((a) => a.articleId === selectedArticle) : null;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {([7, 28, 90] as SearchDateWindow[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => { setDateWindow(d); void load(); }}
              className={`rounded-md px-3 py-1 text-sm ${dateWindow === d ? "bg-[var(--ink)] text-white" : "ring-1 ring-[var(--line)]"}`}
            >
              {d} days
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {overview.lastFetched && (
            <span className="text-xs text-[var(--muted)]">
              Last fetched: {new Date(overview.lastFetched).toLocaleString()}
            </span>
          )}
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={loading}
            className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <p className="text-xs text-[var(--muted)]">
        GSC data is delayed (typically 2–3 days). Period: {overview.currentPeriod.start} – {overview.currentPeriod.end}
        {overview.previousPeriod && ` vs ${overview.previousPeriod.start} – ${overview.previousPeriod.end}`}
      </p>

      {articles.length === 0 && (
        <div className="rounded-lg border border-[var(--line)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">No meaningful Search Console data yet for this period.</p>
        </div>
      )}

      {articles.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Clicks" value={overview.totals.clicks} prev={overview.previousTotals?.clicks} />
            <Stat label="Impressions" value={overview.totals.impressions} prev={overview.previousTotals?.impressions} />
            <Stat label="Avg CTR" value={`${(overview.totals.ctr * 100).toFixed(1)}%`} />
            <Stat label="Avg Position" value={overview.totals.position.toFixed(1)} />
            <Stat label="Articles with data" value={overview.articlesWithData} />
          </div>

          {overview.opportunities.length > 0 && (
            <Section title={`Search Opportunities (${overview.opportunities.length})`}>
              {overview.opportunities.map((opp, i) => (
                <OpportunityCard key={i} opp={opp} />
              ))}
            </Section>
          )}

          <Section title="Article Performance">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] text-left text-xs text-[var(--muted)]">
                    <th className="py-2 pr-4">Article</th>
                    <SortHeader label="Clicks" k="clicks" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                    <SortHeader label="Impressions" k="impressions" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                    <SortHeader label="CTR" k="ctr" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                    <SortHeader label="Position" k="position" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                    <SortHeader label="Δ Clicks" k="clickChange" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((a) => (
                    <tr
                      key={a.articleId}
                      className={`border-b border-[var(--line)] cursor-pointer hover:bg-gray-50 ${selectedArticle === a.articleId ? "bg-blue-50" : ""}`}
                      onClick={() => setSelectedArticle(selectedArticle === a.articleId ? null : a.articleId)}
                    >
                      <td className="py-2 pr-4">
                        <p className="font-medium">{a.title}</p>
                        <p className="text-xs text-[var(--muted)]">{a.type}{a.category ? ` · ${a.category}` : ""}</p>
                      </td>
                      <td className="py-2 pr-4">{a.current.clicks}</td>
                      <td className="py-2 pr-4">{a.current.impressions}</td>
                      <td className="py-2 pr-4">{(a.current.ctr * 100).toFixed(1)}%</td>
                      <td className="py-2 pr-4">{a.current.position.toFixed(1)}</td>
                      <td className="py-2 pr-4">
                        {a.clickChange !== undefined ? (
                          <span className={a.clickChange < 0 ? "text-red-700" : a.clickChange > 0 ? "text-green-700" : ""}>
                            {a.clickChange > 0 ? "+" : ""}{a.clickChange.toFixed(0)}%
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {selected && <ArticleDetail profile={selected} />}

          {unmappedPages.length > 0 && (
            <Section title={`Unmapped GSC Pages (${unmappedPages.length})`}>
              {unmappedPages.slice(0, 20).map((p, i) => (
                <p key={i} className="text-xs text-[var(--muted)]">
                  {p.page} — {p.clicks} clicks, {p.impressions} impressions
                </p>
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, prev }: { label: string; value: number | string; prev?: number }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-3">
      <p className="text-xl font-bold">{value}</p>
      {prev !== undefined && typeof value === "number" && (
        <p className="text-xs text-[var(--muted)]">prev: {prev}</p>
      )}
      <p className="text-xs text-[var(--muted)]">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function SortHeader({ label, k, current, asc, onSort }: { label: string; k: SortKey; current: SortKey; asc: boolean; onSort: (k: SortKey) => void }) {
  return (
    <th className="cursor-pointer py-2 pr-4 hover:text-[var(--ink)]" onClick={() => onSort(k)}>
      {label}{current === k ? (asc ? " ↑" : " ↓") : ""}
    </th>
  );
}

function ArticleDetail({ profile }: { profile: ArticleSearchProfile }) {
  return (
    <Section title={`${profile.title} — Search Detail`}>
      <div className="mb-3 flex gap-4 text-xs text-[var(--muted)]">
        <Link href={`/admin/articles/${profile.articleId}`} className="text-blue-700 hover:underline">Edit Article</Link>
        <Link href={`/admin/links`} className="text-blue-700 hover:underline">Content Graph</Link>
      </div>
      {profile.topQueries.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-[var(--muted)]">
              <th className="py-1 pr-4">Query</th>
              <th className="py-1 pr-4">Clicks</th>
              <th className="py-1 pr-4">Impressions</th>
              <th className="py-1 pr-4">CTR</th>
              <th className="py-1 pr-4">Position</th>
            </tr>
          </thead>
          <tbody>
            {profile.topQueries.map((q, i) => (
              <tr key={i} className="border-b border-[var(--line)]">
                <td className="py-1 pr-4">{q.query}</td>
                <td className="py-1 pr-4">{q.clicks}</td>
                <td className="py-1 pr-4">{q.impressions}</td>
                <td className="py-1 pr-4">{(q.ctr * 100).toFixed(1)}%</td>
                <td className="py-1 pr-4">{q.position.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-[var(--muted)]">No query data for this article.</p>
      )}
    </Section>
  );
}

const KIND_LABELS: Record<string, string> = {
  "update-existing": "Update Existing",
  "internal-link": "Internal Link",
  "create-new": "Create New",
  monitor: "Monitor",
};

const KIND_ACTIONS: Record<string, { label: string; href: (opp: SearchOpportunity) => string }> = {
  "update-existing": { label: "Edit Article", href: (o) => `/admin/articles/${o.articleId}` },
  "internal-link": { label: "View Links", href: () => "/admin/links" },
  "create-new": { label: "Start Draft", href: () => "/admin/articles/new" },
  monitor: { label: "View Article", href: (o) => `/admin/articles/${o.articleId ?? ""}` },
};

function OpportunityCard({ opp }: { opp: SearchOpportunity }) {
  const [aiResult, setAiResult] = useState<AISearchAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const priorityColors = { high: "bg-red-50 text-red-800", medium: "bg-amber-50 text-amber-800", low: "bg-gray-100 text-gray-700" };
  const action = KIND_ACTIONS[opp.kind];

  async function requestAI() {
    setAiLoading(true);
    setAiError(null);
    const result = await analyzeSearchOpportunityAction(opp, opp.articleTitle);
    if (result.ok) setAiResult(result.analysis);
    else setAiError(result.error);
    setAiLoading(false);
  }

  return (
    <div className="mb-3 rounded-md border border-[var(--line)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${priorityColors[opp.priority]}`}>
            {opp.priority}
          </span>
          <span className="ml-2 text-xs font-medium text-[var(--ink)]">{KIND_LABELS[opp.kind]}</span>
          {opp.articleTitle && <p className="mt-1 text-sm font-medium">{opp.articleTitle}</p>}
          {opp.query && <p className="text-sm">Query: &ldquo;{opp.query}&rdquo;</p>}
        </div>
        {action && (
          <Link href={action.href(opp)} className="shrink-0 text-xs text-blue-700 hover:underline">
            {action.label}
          </Link>
        )}
      </div>
      <div className="mt-1 text-xs text-[var(--muted)]">
        {opp.evidence.impressions} impressions · {opp.evidence.clicks} clicks · CTR {(opp.evidence.ctr * 100).toFixed(1)}% · Pos {opp.evidence.position.toFixed(1)}
        {opp.previous && ` (prev: ${opp.previous.clicks} clicks, ${opp.previous.impressions} imp)`}
      </div>
      <ul className="mt-1 text-xs text-[var(--muted)]">
        {opp.reasons.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
      <button type="button" onClick={() => void requestAI()} disabled={aiLoading} className="mt-2 text-xs text-blue-700 hover:underline disabled:opacity-50">
        {aiLoading ? "Analyzing…" : "AI analysis"}
      </button>
      {aiError && <p className="mt-1 text-xs text-red-700">{aiError}</p>}
      {aiResult && (
        <div className="mt-2 rounded border border-blue-100 bg-blue-50 p-2 text-xs">
          <p><strong>Action:</strong> {aiResult.recommendedAction}</p>
          <p>{aiResult.rationale}</p>
          {aiResult.suggestedChanges.length > 0 && (
            <ul className="mt-1 list-disc pl-4">{aiResult.suggestedChanges.map((c, i) => <li key={i}>{c}</li>)}</ul>
          )}
        </div>
      )}
    </div>
  );
}
