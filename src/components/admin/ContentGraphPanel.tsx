"use client";

import { useState } from "react";
import Link from "next/link";
import {
  loadContentGraphAction,
  loadArticleLinkProfileAction,
  suggestInternalLinkPlacementAction,
  type ContentGraphData,
  type ArticleLinkProfileData,
  type AILinkSuggestion,
} from "@/lib/admin/actions";
import type { InternalLinkOpportunity, BrokenLink } from "@/lib/editorial/content-graph";

type View = "overview" | "article" | "product";

export function ContentGraphPanel() {
  const [data, setData] = useState<ContentGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>("overview");
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [profile, setProfile] = useState<ArticleLinkProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  async function loadGraph() {
    setLoading(true);
    const result = await loadContentGraphAction();
    if ("error" in result) {
      setLoading(false);
      return;
    }
    setData(result);
    setLoading(false);
  }

  async function selectArticle(id: string) {
    setSelectedArticle(id);
    setView("article");
    setProfileLoading(true);
    const result = await loadArticleLinkProfileAction(id);
    if ("error" in result) {
      setProfileLoading(false);
      return;
    }
    setProfile(result);
    setProfileLoading(false);
  }

  if (!data && !loading) {
    return (
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
        <p className="mb-3 text-sm text-[var(--muted)]">
          Derive internal linking graph from current Articles and Products.
        </p>
        <button
          type="button"
          onClick={() => void loadGraph()}
          className="rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-gray-50"
        >
          Load content graph
        </button>
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Building content graph…</p>;
  }

  if (!data) return null;

  const { overview, articles, products } = data;
  const articleMap = new Map(articles.map((a) => [a.id, a]));
  const filtered = articles.filter(
    (a) =>
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.slug.toLowerCase().includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-2">
        {(["overview", "article", "product"] as View[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === v ? "bg-[var(--ink)] text-white" : "bg-white ring-1 ring-[var(--line)] text-[var(--ink)]"}`}
          >
            {v === "overview" ? "Overview" : v === "article" ? "Article" : "Product"}
          </button>
        ))}
      </div>

      {/* Overview */}
      {view === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Published" value={overview.publishedCount} />
            <Stat label="Orphans (0 inbound)" value={overview.orphanCandidates.length} warn={overview.orphanCandidates.length > 0} />
            <Stat label="Dead-ends (0 outbound)" value={overview.deadEndCandidates.length} warn={overview.deadEndCandidates.length > 0} />
            <Stat label="Broken links" value={overview.brokenLinks.length} warn={overview.brokenLinks.length > 0} />
            <Stat label="Strong opportunities" value={overview.strongOpportunityCount} />
          </div>

          {overview.brokenLinks.length > 0 && (
            <Section title="Broken Internal Links">
              {overview.brokenLinks.map((b, i) => (
                <BrokenLinkRow key={i} b={b} articleMap={articleMap} onSelect={selectArticle} />
              ))}
            </Section>
          )}

          {overview.orphanCandidates.length > 0 && (
            <Section title="Orphan Candidates (0 inbound links)">
              {overview.orphanCandidates.map((a) => (
                <button key={a.id} type="button" onClick={() => void selectArticle(a.id)} className="block text-sm text-blue-700 hover:underline">
                  {a.title}
                </button>
              ))}
            </Section>
          )}

          {overview.deadEndCandidates.length > 0 && (
            <Section title="Dead-End Candidates (0 outbound links)">
              {overview.deadEndCandidates.map((a) => (
                <button key={a.id} type="button" onClick={() => void selectArticle(a.id)} className="block text-sm text-blue-700 hover:underline">
                  {a.title}
                </button>
              ))}
            </Section>
          )}
        </div>
      )}

      {/* Article view */}
      {view === "article" && (
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Search articles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.slice(0, 30).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => void selectArticle(a.id)}
                className={`rounded-md border p-3 text-left text-sm ${selectedArticle === a.id ? "border-blue-400 bg-blue-50" : "border-[var(--line)] bg-white hover:bg-gray-50"}`}
              >
                <p className="font-medium text-[var(--ink)]">{a.title}</p>
                <p className="text-xs text-[var(--muted)]">{a.type} · {a.status}{a.category ? ` · ${a.category}` : ""}</p>
              </button>
            ))}
          </div>

          {selectedArticle && profileLoading && (
            <p className="text-sm text-[var(--muted)]">Loading profile…</p>
          )}

          {selectedArticle && profile && !profileLoading && (
            <ArticleProfile
              profile={profile}
              articleMap={articleMap}
              onSelect={selectArticle}
            />
          )}
        </div>
      )}

      {/* Product view */}
      {view === "product" && (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProduct(selectedProduct === p.id ? null : p.id)}
                className={`rounded-md border p-3 text-left text-sm ${selectedProduct === p.id ? "border-blue-400 bg-blue-50" : "border-[var(--line)] bg-white hover:bg-gray-50"}`}
              >
                <p className="font-medium text-[var(--ink)]">{p.name}</p>
                <p className="text-xs text-[var(--muted)]">{p.category} · {p.referencingArticleIds.length} articles</p>
              </button>
            ))}
          </div>

          {selectedProduct && (
            <Section title={`Articles referencing ${products.find((p) => p.id === selectedProduct)?.name ?? selectedProduct}`}>
              {products
                .find((p) => p.id === selectedProduct)
                ?.referencingArticleIds.map((aid) => {
                  const a = articleMap.get(aid);
                  return a ? (
                    <button key={aid} type="button" onClick={() => void selectArticle(aid)} className="block text-sm text-blue-700 hover:underline">
                      {a.title} ({a.type})
                    </button>
                  ) : (
                    <p key={aid} className="text-xs text-[var(--muted)]">{aid}</p>
                  );
                })}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${warn ? "border-amber-200 bg-amber-50" : "border-[var(--line)] bg-white"}`}>
      <p className="text-2xl font-bold text-[var(--ink)]">{value}</p>
      <p className="text-xs text-[var(--muted)]">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold text-[var(--ink)]">{title}</h3>
      {children}
    </div>
  );
}

function BrokenLinkRow({
  b,
  articleMap,
  onSelect,
}: {
  b: BrokenLink;
  articleMap: Map<string, { id: string; title: string }>;
  onSelect: (id: string) => void;
}) {
  const source = articleMap.get(b.sourceArticleId);
  return (
    <p className="text-sm text-red-800">
      <button type="button" onClick={() => onSelect(b.sourceArticleId)} className="font-medium hover:underline">
        {source?.title ?? b.sourceArticleId}
      </button>
      {" → "}
      <code className="text-xs">/blog/{b.targetSlug}</code>
      <span className="text-xs text-[var(--muted)]"> ({b.location})</span>
    </p>
  );
}

function ArticleProfile({
  profile,
  articleMap,
  onSelect,
}: {
  profile: ArticleLinkProfileData;
  articleMap: Map<string, { id: string; title: string; type: string; status: string }>;
  onSelect: (id: string) => void;
}) {
  const current = articleMap.get(profile.articleId);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--line)] bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-[var(--ink)]">
          {current?.title ?? profile.articleId}
        </h3>
        <div className="flex flex-wrap gap-4 text-xs text-[var(--muted)]">
          <span>Outbound: {profile.outboundArticleIds.length}</span>
          <span>Inbound: {profile.inboundArticleIds.length}</span>
          <span>Products: {profile.productIds.length}</span>
          <span>Broken: {profile.brokenLinks.length}</span>
        </div>
        <div className="mt-2">
          <Link href={`/admin/articles/${profile.articleId}`} className="text-xs text-blue-700 hover:underline">
            Edit article
          </Link>
        </div>
      </div>

      {profile.outboundArticleIds.length > 0 && (
        <Section title="Outbound Links">
          {profile.outboundArticleIds.map((id) => (
            <ArticleLink key={id} id={id} articleMap={articleMap} onSelect={onSelect} />
          ))}
        </Section>
      )}

      {profile.inboundArticleIds.length > 0 && (
        <Section title="Inbound Links">
          {profile.inboundArticleIds.map((id) => (
            <ArticleLink key={id} id={id} articleMap={articleMap} onSelect={onSelect} />
          ))}
        </Section>
      )}

      {profile.brokenLinks.length > 0 && (
        <Section title="Broken Links">
          {profile.brokenLinks.map((b, i) => (
            <p key={i} className="text-sm text-red-800">
              /blog/{b.targetSlug} <span className="text-xs text-[var(--muted)]">({b.location})</span>
            </p>
          ))}
        </Section>
      )}

      {profile.opportunities.length > 0 && (
        <Section title="Outgoing Link Opportunities">
          {profile.opportunities.map((opp, i) => (
            <OpportunityRow key={i} opp={opp} articleMap={articleMap} onSelect={onSelect} />
          ))}
        </Section>
      )}

      {profile.backlinkOpportunities.length > 0 && (
        <Section title="Backlink Opportunities (others → this)">
          {profile.backlinkOpportunities.map((opp, i) => (
            <OpportunityRow key={i} opp={opp} articleMap={articleMap} onSelect={onSelect} direction="backlink" />
          ))}
        </Section>
      )}
    </div>
  );
}

function ArticleLink({
  id,
  articleMap,
  onSelect,
}: {
  id: string;
  articleMap: Map<string, { id: string; title: string; type: string }>;
  onSelect: (id: string) => void;
}) {
  const a = articleMap.get(id);
  return (
    <button type="button" onClick={() => onSelect(id)} className="block text-sm text-blue-700 hover:underline">
      {a?.title ?? id} <span className="text-xs text-[var(--muted)]">({a?.type ?? "unknown"})</span>
    </button>
  );
}

function OpportunityRow({
  opp,
  articleMap,
  onSelect,
  direction,
}: {
  opp: InternalLinkOpportunity;
  articleMap: Map<string, { id: string; title: string; type: string; status: string }>;
  onSelect: (id: string) => void;
  direction?: "backlink";
}) {
  const displayId = direction === "backlink" ? opp.sourceArticleId : opp.targetArticleId;
  const editId = direction === "backlink" ? opp.sourceArticleId : opp.sourceArticleId;
  const target = articleMap.get(displayId);
  const source = articleMap.get(opp.sourceArticleId);
  const targetInfo = articleMap.get(opp.targetArticleId);
  const [aiResult, setAiResult] = useState<AILinkSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const strengthColors = { strong: "text-green-800 bg-green-50", medium: "text-amber-800 bg-amber-50", weak: "text-gray-700 bg-gray-100" };

  async function requestAI() {
    setAiLoading(true);
    setAiError(null);
    const result = await suggestInternalLinkPlacementAction(
      source?.title ?? "",
      "",
      targetInfo?.title ?? "",
      "",
      opp.reasons,
    );
    if (result.ok) {
      setAiResult(result.suggestion);
    } else {
      setAiError(result.error);
    }
    setAiLoading(false);
  }

  return (
    <div className="mb-3 rounded-md border border-[var(--line)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <button type="button" onClick={() => onSelect(displayId)} className="text-sm font-medium text-blue-700 hover:underline">
            {target?.title ?? displayId}
          </button>
          <span className={`ml-2 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${strengthColors[opp.strength]}`}>
            {opp.strength}
          </span>
        </div>
        <Link href={`/admin/articles/${editId}`} className="shrink-0 text-xs text-[var(--muted)] hover:underline">
          Edit source
        </Link>
      </div>
      <ul className="mt-1 text-xs text-[var(--muted)]">
        {opp.reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void requestAI()}
          disabled={aiLoading}
          className="text-xs text-blue-700 hover:underline disabled:opacity-50"
        >
          {aiLoading ? "Generating…" : "AI anchor suggestion"}
        </button>
      </div>
      {aiError && <p className="mt-1 text-xs text-red-700">{aiError}</p>}
      {aiResult && (
        <div className="mt-2 rounded border border-blue-100 bg-blue-50 p-2 text-xs">
          <p><strong>Anchor:</strong> {aiResult.anchorText}</p>
          {aiResult.suggestedSentence && <p><strong>Sentence:</strong> {aiResult.suggestedSentence}</p>}
          {aiResult.placementHint && <p><strong>Hint:</strong> {aiResult.placementHint}</p>}
        </div>
      )}
    </div>
  );
}
