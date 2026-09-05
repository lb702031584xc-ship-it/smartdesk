import { PRODUCT_CATEGORY_LABELS } from "@/lib/admin/editor-constants";

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "published"
      ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
      : status === "draft"
        ? "bg-zinc-100 text-zinc-700 ring-zinc-200"
        : status === "archived"
          ? "bg-stone-100 text-stone-700 ring-stone-200"
          : status === "scheduled"
            ? "bg-sky-50 text-sky-900 ring-sky-200"
            : "bg-amber-50 text-amber-900 ring-amber-200";

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${tone}`}>
      {status}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  const label =
    category in PRODUCT_CATEGORY_LABELS
      ? PRODUCT_CATEGORY_LABELS[category as keyof typeof PRODUCT_CATEGORY_LABELS]
      : category;
  return (
    <span className="inline-flex rounded-full bg-[var(--canvas)] px-2 py-0.5 text-xs font-medium text-[var(--ink)] ring-1 ring-[var(--line)]">
      {label}
    </span>
  );
}

export function SignalBadge({ label }: { label: string }) {
  const tone =
    label === "Featured"
      ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
      : "bg-amber-50 text-amber-900 ring-amber-200";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${tone}`}>
      {label}
    </span>
  );
}
