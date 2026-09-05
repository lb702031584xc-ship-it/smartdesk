import Link from "next/link";
import type { ProductMaterialChangeContext } from "@/lib/editorial/product-impact-context";

export function ProductMaintenanceArticleContextPanel({
  productId,
  productName,
  context,
}: {
  productId: string;
  productName: string;
  context: ProductMaterialChangeContext;
}) {
  if (!context.available) {
    return (
      <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-950">Product Maintenance Context</h3>
        <p className="text-sm text-gray-800">
          Opened from Product maintenance. No prior Product revision is available for material change comparison.
        </p>
        <Link
          href={`/admin/products/${productId}?from=maintenance`}
          className="mt-2 inline-block text-xs text-blue-700 hover:underline"
        >
          View Product: {productName}
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-violet-200 bg-violet-50 p-4">
      <h3 className="mb-1 text-sm font-semibold text-violet-950">Product Maintenance Context</h3>
      <p className="mb-2 text-xs text-violet-800">
        Product <strong>{productName}</strong> ({productId}) changed materially. Structured Product display may
        already be updated, but Article prose may still reference old Product claims.
      </p>
      {context.changedAt && (
        <p className="mb-2 text-xs text-violet-800">
          Latest change: revision #{context.revisionNumber} · {new Date(context.changedAt).toLocaleString()}
        </p>
      )}
      <p className="mb-1 text-xs font-medium text-violet-900">Material changes:</p>
      <ul className="mb-3 list-disc pl-5 text-sm text-violet-900">
        {context.materialFields.map((field) => (
          <li key={field}>{field}</li>
        ))}
      </ul>
      <p className="mb-1 text-xs text-violet-800">
        Review prose that references this Product for stale claims (ratings, verdicts, specs).
      </p>
      <Link
        href={`/admin/products/${productId}?from=maintenance`}
        className="inline-block text-xs text-blue-700 hover:underline"
      >
        Open Product editor
      </Link>
    </div>
  );
}
