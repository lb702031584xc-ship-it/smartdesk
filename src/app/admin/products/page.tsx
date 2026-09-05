import Link from "next/link";
import { AdminWriteBanner } from "@/components/admin/AdminSection";
import { ProductListClient } from "@/components/admin/ProductListClient";
import { getAdminWriteMode, listAdminProducts } from "@/lib/admin";

export default async function AdminProductsPage() {
  const products = await listAdminProducts();
  const writeMode = getAdminWriteMode();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink)]">Products</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{products.length} Product V1 records</p>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white"
        >
          New Product
        </Link>
      </div>
      <AdminWriteBanner writeMode={writeMode} />
      <ProductListClient products={products} />
    </div>
  );
}
