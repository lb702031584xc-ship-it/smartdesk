import type { RefreshCandidate } from "@/lib/editorial/content-refresh";

const REASON_LABELS: Record<string, string> = {
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

export function RefreshContextPanel({ candidate }: { candidate: RefreshCandidate }) {
  return (
    <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <h3 className="mb-1 text-sm font-semibold text-blue-950">Refresh Context</h3>
      <p className="mb-2 text-xs text-blue-800">You opened this Article from the Refresh Queue because:</p>
      <ul className="list-disc pl-5 text-sm text-blue-900">
        {candidate.reasons.map((r, i) => (
          <li key={i}>{REASON_LABELS[r.type] ?? r.type}: {r.message}</li>
        ))}
      </ul>
      {candidate.evidence.search && (
        <p className="mt-2 text-xs text-blue-800">
          Search: {candidate.evidence.search.impressions} impressions, {candidate.evidence.search.clicks} clicks, CTR {(candidate.evidence.search.ctr * 100).toFixed(1)}%
        </p>
      )}
      {candidate.evidence.graph && candidate.evidence.graph.backlinkOpportunityCount > 0 && (
        <p className="mt-1 text-xs text-blue-800">
          Graph: {candidate.evidence.graph.inboundLinks} inbound links, {candidate.evidence.graph.backlinkOpportunityCount} backlink opportunities
        </p>
      )}
    </div>
  );
}
