import { ContentGraphPanel } from "@/components/admin/ContentGraphPanel";

export default function AdminLinksPage() {
  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-[var(--ink)]">Content Graph</h1>
      <ContentGraphPanel />
    </div>
  );
}
