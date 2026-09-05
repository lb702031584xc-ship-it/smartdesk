import type { ProductMaintenanceCandidate } from "@/lib/editorial/product-maintenance";

const REASON_LABELS: Record<string, string> = {
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

export function MaintenanceContextPanel({ candidate }: { candidate: ProductMaintenanceCandidate }) {
  const deps = candidate.evidence.dependencies;
  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h3 className="mb-1 text-sm font-semibold text-amber-950">Maintenance Context</h3>
      <p className="mb-2 text-xs text-amber-800">You opened this Product from the Maintenance Queue because:</p>
      <ul className="list-disc pl-5 text-sm text-amber-900">
        {candidate.reasons.map((r) => (
          <li key={r.id}>{REASON_LABELS[r.type] ?? r.type}: {r.message}</li>
        ))}
      </ul>
      {deps && deps.publishedRefs > 0 && (
        <p className="mt-2 text-xs text-amber-800">
          Referenced by {deps.publishedRefs} published Article{deps.publishedRefs === 1 ? "" : "s"} — changes will revalidate dependent content.
        </p>
      )}
    </div>
  );
}
