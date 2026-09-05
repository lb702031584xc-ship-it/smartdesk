import Link from "next/link";
import { AffiliateDisclaimer } from "@/components/AffiliateDisclaimer";
import type { ArticleViewModel } from "@/types/article-view-model";

const TYPE_LABEL: Record<string, string> = {
  "best-list": "Best list",
  review: "Review",
  comparison: "Comparison",
  guide: "Guide",
  "how-to": "Guide",
  informational: "Guide",
};

type NativeArticleHeaderProps = {
  view: ArticleViewModel;
  categoryName?: string;
  categoryHref?: string;
};

/**
 * Native header driven by ArticleViewModel (same visual language as legacy).
 */
export function NativeArticleHeader({
  view,
  categoryName,
  categoryHref,
}: NativeArticleHeaderProps) {
  const { article, publishing, readingTime } = view;
  const date = publishing.publishedAt ?? "";
  const updated = publishing.updatedAt;

  return (
    <header className="border-b border-[var(--line)] pb-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--subtle)]">
        <span>{TYPE_LABEL[article.classification.type] ?? article.classification.type}</span>
        {categoryName && categoryHref ? (
          <>
            <span aria-hidden>•</span>
            <Link href={categoryHref} className="hover:text-[var(--ink)]">
              {categoryName}
            </Link>
          </>
        ) : null}
        {date ? (
          <>
            <span aria-hidden>•</span>
            <time dateTime={date}>
              {new Date(date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </time>
          </>
        ) : null}
        {updated ? (
          <>
            <span aria-hidden>•</span>
            <span>
              Updated{" "}
              {new Date(updated).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </>
        ) : null}
        <span aria-hidden>•</span>
        <span>{readingTime}</span>
      </div>

      <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl font-medium leading-[1.12] tracking-tight text-[var(--ink)] sm:text-5xl">
        {article.identity.title}
      </h1>

      {article.editorial.summary ? (
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-[var(--muted)]">
          {article.editorial.summary}
        </p>
      ) : null}

      <div className="mt-6">
        <AffiliateDisclaimer />
      </div>
    </header>
  );
}
