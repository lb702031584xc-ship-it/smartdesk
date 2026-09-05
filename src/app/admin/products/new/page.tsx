import Link from "next/link";
import { ProductEditorForm } from "@/components/admin/ProductEditorForm";
import { AdminWriteBanner } from "@/components/admin/AdminSection";
import { blankProductV1 } from "@/lib/admin/blank-product";
import { getAdminWriteMode, listAdminProducts } from "@/lib/admin";

export default async function AdminNewProductPage() {
  const writeMode = getAdminWriteMode();
  const products = await listAdminProducts();
  const productOptions = products.map((item) => ({
    id: item.id,
    name: item.name,
    brand: item.brand,
    category: item.category,
    rating: item.rating,
  }));

  return (
    <div>
      <Link
        href="/admin/products"
        className="text-sm text-[var(--muted)] underline-offset-2 hover:underline"
      >
        ← Products
      </Link>
      <AdminWriteBanner writeMode={writeMode} />
      {writeMode !== "database" ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Product creation is only available when CONTENT_STORE=database. Filesystem
          create is disabled so repository JSON does not become a second source of truth.
        </p>
      ) : null}
      <ProductEditorForm
        mode="create"
        product={blankProductV1()}
        productOptions={productOptions}
        writeMode={writeMode}
        existingProductIds={products.map((item) => item.id)}
      />
    </div>
  );
}
