import Link from "next/link";

import { notFound } from "next/navigation";

import { ArticleEditorForm } from "@/components/admin/ArticleEditorForm";

import { AdminWriteBanner } from "@/components/admin/AdminSection";

import {

  getAdminArticle,

  getAdminWriteMode,

  getArticleRevisionCount,

  listAdminArticleIds,

  listAdminProducts,

  getAdminProduct,

} from "@/lib/admin";

import { loadRefreshQueueData } from "@/lib/editorial/refresh-loader";

import { getRefreshCandidate } from "@/lib/editorial/content-refresh";

import { loadProductMaterialChangeContext } from "@/lib/editorial/product-commerce-loader";



type PageProps = {

  params: Promise<{ id: string }>;

  searchParams: Promise<{ created?: string; from?: string; productId?: string }>;

};



export async function generateStaticParams() {

  const ids = await listAdminArticleIds();

  return ids.map((id) => ({ id }));

}



export const dynamicParams = true;



export default async function AdminArticleDetailPage({ params, searchParams }: PageProps) {

  const { id } = await params;

  const { created, from, productId } = await searchParams;

  const record = await getAdminArticle(id);



  if (!record) {

    notFound();

  }



  let refreshCandidate = undefined;

  if (from === "refresh") {

    const queue = await loadRefreshQueueData();

    refreshCandidate = getRefreshCandidate(id, queue);

  }



  let productMaintenanceContext = undefined;

  let productMaintenanceName = undefined;

  if (from === "product-maintenance" && productId) {

    const productRecord = await getAdminProduct(productId);

    if (productRecord) {

      productMaintenanceName = productRecord.product.identity.name;

      productMaintenanceContext = await loadProductMaterialChangeContext(productRecord.product);

    }

  }



  const writeMode = getAdminWriteMode();

  const revisionCount = await getArticleRevisionCount(id);

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

        href="/admin/articles"

        className="text-sm text-[var(--muted)] underline-offset-2 hover:underline"

      >

        ← Articles

      </Link>

      <p className="mt-2 text-sm text-[var(--muted)]">
        Editorial workspace:{" "}
        <Link
          href={`/admin/articles/${id}/workspace`}
          className="underline underline-offset-2 hover:text-[var(--ink)]"
        >
          /workspace
        </Link>
        {" · "}
        Controlled metadata edits:{" "}
        <Link
          href={`/admin/articles/${id}/edit`}
          className="underline underline-offset-2 hover:text-[var(--ink)]"
        >
          /edit
        </Link>
        {" · "}
        <Link
          href={`/admin/articles/${id}/workflow`}
          className="underline underline-offset-2 hover:text-[var(--ink)]"
        >
          /workflow
        </Link>
      </p>

      <AdminWriteBanner writeMode={writeMode} />

      <ArticleEditorForm

        article={record.article}

        body={record.body ?? ""}

        productOptions={productOptions}

        writeMode={writeMode}

        version={record.version}

        sourceFile={record.sourceFile}

        revisionCount={revisionCount}

        justCreated={created === "1"}

        refreshCandidate={refreshCandidate}

        productMaintenanceContext={productMaintenanceContext}

        productMaintenanceProductId={productId}

        productMaintenanceProductName={productMaintenanceName}

      />

    </div>

  );

}

