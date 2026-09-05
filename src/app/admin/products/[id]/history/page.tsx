import { notFound } from "next/navigation";
import { ProductHistoryClient } from "@/components/admin/ProductHistoryClient";
import { AdminWriteBanner } from "@/components/admin/AdminSection";
import { EditorialWorkspaceShell } from "@/components/editorial/EditorialWorkspaceShell";
import {
  getAdminProduct,
  getAdminWriteMode,
  listAdminProductIds,
} from "@/lib/admin";
import { listProductRevisionItems } from "@/lib/admin/revision-store";
import { getEditorialWorkspace } from "@/lib/editorial-workspace";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  const ids = await listAdminProductIds();
  return ids.map((id) => ({ id }));
}

export const dynamicParams = true;

export default async function AdminProductHistoryPage({ params }: PageProps) {
  const { id } = await params;
  const [record, workspace] = await Promise.all([
    getAdminProduct(id),
    getEditorialWorkspace("product", id),
  ]);
  if (!record || !workspace) notFound();

  const revisions = await listProductRevisionItems(id);
  const writeMode = getAdminWriteMode();

  return (
    <EditorialWorkspaceShell
      entityType="product"
      entityId={id}
      entityName={workspace.entityName}
      links={workspace.links}
      activeSurface="history"
      listHref="/admin/products"
      listLabel="Products"
    >
      <AdminWriteBanner writeMode={writeMode} />
      <ProductHistoryClient
        productId={id}
        name={record.product.identity.name}
        currentVersion={record.version}
        revisions={revisions}
      />
    </EditorialWorkspaceShell>
  );
}
