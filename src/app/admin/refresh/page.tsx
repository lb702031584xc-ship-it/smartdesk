import { RefreshQueuePanel } from "@/components/admin/RefreshQueuePanel";

export default function AdminRefreshPage() {
  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-[var(--ink)]">Content Refresh Queue</h1>
      <RefreshQueuePanel />
    </div>
  );
}
