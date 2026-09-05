import Link from "next/link";

import { ProductEditorForm } from "@/components/admin/ProductEditorForm";

import { AdminWriteBanner } from "@/components/admin/AdminSection";

import { getAdminProduct, getAdminWriteMode, getProductRevisionCount, listAdminProductIds, listAdminProducts } from "@/lib/admin";

import { notFound } from "next/navigation";



import { loadProductMaintenanceQueueData } from "@/lib/editorial/product-maintenance-loader";

import { getProductMaintenanceCandidate } from "@/lib/editorial/product-maintenance";

import {

  loadProductDependencyProfile,

  loadProductMaterialChangeContext,

} from "@/lib/editorial/product-commerce-loader";



type PageProps = {

  params: Promise<{ id: string }>;

  searchParams: Promise<{ created?: string; from?: string }>;

};



export async function generateStaticParams() {

  const ids = await listAdminProductIds();

  return ids.map((id) => ({ id }));

}



export const dynamicParams = true;



export default async function AdminProductDetailPage({ params, searchParams }: PageProps) {

  const { id } = await params;

  const { created, from } = await searchParams;

  const record = await getAdminProduct(id);



  if (!record) {

    notFound();

  }



  let maintenanceCandidate = undefined;

  if (from === "maintenance") {

    const queue = await loadProductMaintenanceQueueData();

    maintenanceCandidate = getProductMaintenanceCandidate(id, queue);

  }



  const dependencyProfile = await loadProductDependencyProfile(id);

  const materialChangeContext = await loadProductMaterialChangeContext(record.product);



  const writeMode = getAdminWriteMode();

  const revisionCount = await getProductRevisionCount(id);

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

      <p className="mt-2 text-sm text-[var(--muted)]">
        Editorial workspace:{" "}
        <Link
          href={`/admin/products/${id}/workspace`}
          className="underline underline-offset-2 hover:text-[var(--ink)]"
        >
          /workspace
        </Link>
        {" · "}
        Controlled editorial edits:{" "}
        <Link
          href={`/admin/products/${id}/edit`}
          className="underline underline-offset-2 hover:text-[var(--ink)]"
        >
          /edit
        </Link>
        {" · "}
        <Link
          href={`/admin/products/${id}/workflow`}
          className="underline underline-offset-2 hover:text-[var(--ink)]"
        >
          /workflow
        </Link>
      </p>

      <AdminWriteBanner writeMode={writeMode} />

      <ProductEditorForm

        product={record.product}

        productOptions={productOptions}

        writeMode={writeMode}

        version={record.version}

        revisionCount={revisionCount}

        justCreated={created === "1"}

        maintenanceCandidate={maintenanceCandidate}

        dependencyProfile={dependencyProfile}

        materialChangeContext={materialChangeContext}

      />

    </div>

  );

}

