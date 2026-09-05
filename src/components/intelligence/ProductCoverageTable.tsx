import React from "react";
import type { ProductCoverageViewModel } from "@/types/content-dashboard";
import {
  IntelligenceEmptyState,
  IntelligenceSection,
  SignalBadge,
  productCoverageLabel,
  productCoverageTone,
} from "@/components/intelligence/SignalBadge";

type ProductCoverageTableProps = {
  products: ProductCoverageViewModel[];
};

export function ProductCoverageTable({ products }: ProductCoverageTableProps) {
  if (products.length === 0) {
    return (
      <IntelligenceSection title="Product Coverage">
        <IntelligenceEmptyState message="No products found in the catalog." />
      </IntelligenceSection>
    );
  }

  return (
    <IntelligenceSection
      title="Product Coverage"
      description="How many articles feature each product."
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--subtle)]">
            <tr>
              <th className="px-2 py-2 font-semibold">Product</th>
              <th className="px-2 py-2 font-semibold">Category</th>
              <th className="px-2 py-2 font-semibold">Articles</th>
              <th className="px-2 py-2 font-semibold">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.productId} className="border-b border-[var(--line)]">
                <td className="px-2 py-3">
                  <p className="font-medium text-[var(--ink)]">{product.name}</p>
                  <p className="text-xs text-[var(--subtle)]">{product.productId}</p>
                </td>
                <td className="px-2 py-3 text-[var(--muted)]">{product.category}</td>
                <td className="px-2 py-3 text-[var(--muted)]">{product.articleCount}</td>
                <td className="px-2 py-3">
                  <SignalBadge
                    label={productCoverageLabel(product.coverageStatus)}
                    tone={productCoverageTone(product.coverageStatus)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </IntelligenceSection>
  );
}
