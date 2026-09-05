import { ProductMaintenancePanel } from "@/components/admin/ProductMaintenancePanel";

export default function AdminMaintenancePage() {
  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-[var(--ink)]">Product Maintenance</h1>
      <ProductMaintenancePanel />
    </div>
  );
}
