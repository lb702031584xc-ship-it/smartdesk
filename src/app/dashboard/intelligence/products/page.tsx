import { ProductCoverageTable } from "@/components/intelligence/ProductCoverageTable";
import { getProductCoverageViewModels } from "@/lib/content-dashboard";

export default async function IntelligenceProductsPage() {
  const products = await getProductCoverageViewModels();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink)]">
          Product Coverage
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Which products appear in articles. Missing content is a gap signal, not a fix.
        </p>
      </div>
      <ProductCoverageTable products={products} />
    </div>
  );
}
