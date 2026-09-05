import Link from "next/link";
import { AdminWriteBanner } from "@/components/admin/AdminSection";
import { getAdminOverviewStats } from "@/lib/admin";
import { loadRefreshQueueData } from "@/lib/editorial/refresh-loader";
import { loadProductMaintenanceQueueData } from "@/lib/editorial/product-maintenance-loader";

export default async function AdminHomePage() {
  let stats;
  try {
    stats = await getAdminOverviewStats();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h1 className="text-lg font-semibold text-red-950">Admin could not load content</h1>
        <p className="mt-2 text-sm text-red-900">
          The server failed while reading the content store. Check Vercel Production env:
          <code className="mx-1 rounded bg-white px-1">CONTENT_STORE=database</code>
          and
          <code className="mx-1 rounded bg-white px-1">DATABASE_URL</code>
          (no wrapping quotes, no leading/trailing spaces), then Redeploy.
        </p>
        <p className="mt-3 break-all font-mono text-xs text-red-800">{message}</p>
      </div>
    );
  }

  let refreshCounts = null;
  let maintenanceCounts = null;
  try {
    const queue = await loadRefreshQueueData();
    refreshCounts = queue.counts;
  } catch {
    refreshCounts = null;
  }
  try {
    const maintenance = await loadProductMaintenanceQueueData();
    maintenanceCounts = maintenance.counts;
  } catch {
    maintenanceCounts = null;
  }
  const statusCards = [
    { label: "Published", value: stats.publishedArticles },
    { label: "Draft", value: stats.draftArticles },
    { label: "Review", value: stats.reviewArticles },
    { label: "Scheduled", value: stats.scheduledArticles },
    { label: "Archived", value: stats.archivedArticles },
    { label: "Featured articles", value: stats.featuredArticles },
    { label: "Featured products", value: stats.featuredProducts },
  ].filter((card) => card.value > 0);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--ink)]">Editorial overview</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Counts come from canonical Article V1 and Product V1 in the configured content store.
      </p>

      <AdminWriteBanner writeMode={stats.writeMode} />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Products" value={stats.productCount} href="/admin/products" />
        <StatCard label="Articles" value={stats.articleCount} href="/admin/articles" />
        {refreshCounts && refreshCounts.total > 0 && (
          <Link href="/admin/refresh" className="block transition-opacity hover:opacity-90">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm text-amber-900">Refresh candidates</p>
              <p className="mt-1 text-3xl font-semibold text-amber-950">{refreshCounts.total}</p>
              <p className="mt-1 text-xs text-amber-800">
                High: {refreshCounts.high} · Medium: {refreshCounts.medium}
              </p>
            </div>
          </Link>
        )}
        {maintenanceCounts && maintenanceCounts.total > 0 && (
          <Link href="/admin/maintenance" className="block transition-opacity hover:opacity-90">
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-5">
              <p className="text-sm text-orange-900">Product maintenance</p>
              <p className="mt-1 text-3xl font-semibold text-orange-950">{maintenanceCounts.total}</p>
              <p className="mt-1 text-xs text-orange-800">
                High: {maintenanceCounts.high} · Medium: {maintenanceCounts.medium}
              </p>
            </div>
          </Link>
        )}
        {statusCards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} />
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--ink)]">Needs attention</h2>
        {stats.attention.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">No editorial signals right now.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {stats.attention.map((item) => (
              <li key={item.message}>
                <AttentionRow item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-sm text-[var(--muted)]">
        Write mode: <strong>{stats.writeMode}</strong>
        {stats.writeMode === "database"
          ? " — durable database persistence (auth-gated)."
          : stats.writeMode === "disabled"
            ? " — set CONTENT_STORE=database + DATABASE_URL for production writes."
            : " — local filesystem JSON (development only)."}
      </p>
    </div>
  );
}

function AttentionRow({
  item,
}: {
  item: { severity: "error" | "warning" | "info"; message: string; href?: string };
}) {
  const tone =
    item.severity === "error"
      ? "border-red-200 bg-red-50 text-red-950"
      : item.severity === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-[var(--line)] bg-white text-[var(--ink)]";
  const body = (
    <div className={`rounded-lg border px-4 py-3 text-sm ${tone}`}>
      <span className="mr-2 text-xs font-semibold uppercase tracking-wide">{item.severity}</span>
      {item.message}
    </div>
  );
  if (item.href) {
    return (
      <Link href={item.href} className="block hover:opacity-90">
        {body}
      </Link>
    );
  }
  return body;
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const body = (
    <div className="rounded-lg border border-[var(--line)] bg-white p-5">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block transition-opacity hover:opacity-90">
        {body}
      </Link>
    );
  }

  return body;
}
