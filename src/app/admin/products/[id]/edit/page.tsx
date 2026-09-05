import { notFound } from "next/navigation";
import { AdminWriteBanner } from "@/components/admin/AdminSection";
import { ProductEditorialEditor } from "@/components/admin/ProductEditorialEditor";
import { EditorialWorkspaceShell } from "@/components/editorial/EditorialWorkspaceShell";
import {
  getAdminProduct,
  getAdminWriteMode,
  listAdminProductIds,
} from "@/lib/admin";
import { getEditorialWorkspace } from "@/lib/editorial-workspace";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  const ids = await listAdminProductIds();
  return ids.map((id) => ({ id }));
}

export const dynamicParams = true;

/**
 * Phase 34 — controlled Product editorial editor.
 * Read/write only editorial.role | verdict | bestFor | notFor.
 */
export default async function AdminProductEditorialEditPage({
  params,
}: PageProps) {
  const { id } = await params;
  const [record, workspace] = await Promise.all([
    getAdminProduct(id),
    getEditorialWorkspace("product", id),
  ]);
  if (!record || !workspace) notFound();

  const writeMode = getAdminWriteMode();

  return (
    <EditorialWorkspaceShell
      entityType="product"
      entityId={id}
      entityName={workspace.entityName}
      links={workspace.links}
      activeSurface="edit"
      listHref="/admin/products"
      listLabel="Products"
    >
      <AdminWriteBanner writeMode={writeMode} />
      <ProductEditorialEditor
        product={record.product}
        version={record.version}
        writeMode={writeMode}
      />
    </EditorialWorkspaceShell>
  );
}
