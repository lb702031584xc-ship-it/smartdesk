import Link from "next/link";
import { AffiliateDisclaimer } from "@/components/AffiliateDisclaimer";
import type { ArticleMeta } from "@/types/article";

type ArticleHeaderProps = {
  article: ArticleMeta;
  categoryName?: string;
  categoryHref?: string;
};

export function ArticleHeader({
  article,
  categoryName,
  categoryHref,
}: ArticleHeaderProps) {
  const typeLabel: Record<string, string> = {
    best: "Best list",
    review: "Review",
    comparison: "Comparison",
    guide: "Guide",
  };

  return (
    <header className="border-b border-[var(--line)] pb-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--subtle)]">
        <span>{typeLabel[article.type]}</span>
        {categoryName && categoryHref ? (
          <>
            <span aria-hidden>•</span>
            <Link href={categoryHref} className="hover:text-[var(--ink)]">
              {categoryName}
            </Link>
          </>
        ) : null}
        <span aria-hidden>•</span>
        <time dateTime={article.date}>
          {new Date(article.date).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </time>
        {article.updated ? (
          <>
            <span aria-hidden>•</span>
            <span>
              Updated{" "}
              {new Date(article.updated).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </>
        ) : null}
        <span aria-hidden>•</span>
        <span>{article.readingTime}</span>
      </div>

      <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl font-medium leading-[1.12] tracking-tight text-[var(--ink)] sm:text-5xl">
        {article.title}
      </h1>

      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-[var(--muted)]">
        {article.description}
      </p>

      {article.intro ? (
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-[var(--muted)]">
          {article.intro}
        </p>
      ) : null}

      <div className="mt-6">
        <AffiliateDisclaimer />
      </div>
    </header>
  );
}
