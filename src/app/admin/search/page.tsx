import { SearchPerformancePanel } from "@/components/admin/SearchPerformancePanel";

export default function AdminSearchPage() {
  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-[var(--ink)]">Search Performance</h1>
      <SearchPerformancePanel />
    </div>
  );
}
