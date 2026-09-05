import { AffiliateButton } from "@/components/AffiliateButton";
import { ArticleHeader } from "@/components/article/ArticleHeader";
import { FAQ } from "@/components/article/FAQ";
import { InternalLinks } from "@/components/article/InternalLinks";
import { ProductCard } from "@/components/article/ProductCard";
import { ProsCons } from "@/components/article/ProsCons";
import { RatingBox } from "@/components/article/RatingBox";
import type { ArticleMeta, ResolvedArticle } from "@/types/article";

type ReviewTemplateProps = {
  article: ResolvedArticle;
  categoryName?: string;
  categoryHref?: string;
  relatedPosts?: ArticleMeta[];
};

export function ReviewTemplate({
  article,
  categoryName,
  categoryHref,
  relatedPosts = [],
}: ReviewTemplateProps) {
  const product = article.resolvedProduct ?? article.resolvedProducts[0];

  if (!product) {
    return (
      <article className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
        <ArticleHeader
          article={article}
          categoryName={categoryName}
          categoryHref={categoryHref}
        />
        <p className="mt-8 text-[var(--muted)]">
          This review is missing a valid product ID in frontmatter.
        </p>
      </article>
    );
  }

  return (
    <article className="mx-auto max-w-4xl px-5 py-14 sm:px-8 sm:py-16">
      <ArticleHeader
        article={article}
        categoryName={categoryName}
        categoryHref={categoryHref}
      />

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_240px]">
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--subtle)]">
            Verdict
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-medium text-[var(--ink)]">
            {product.name}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
            {product.verdict ?? product.summary ?? article.description}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <AffiliateButton
              href={product.amazonUrl}
              label="Check current price"
            />
            <span className="text-sm text-[var(--subtle)]">
              {product.priceRange}
            </span>
          </div>
        </section>

        <RatingBox
          rating={product.rating}
          label="Overall score"
          categories={article.ratingCategories}
        />
      </div>

      <section className="mt-12">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-medium text-[var(--ink)]">
          Pros and cons
        </h2>
        <div className="mt-5 rounded-2xl border border-[var(--line)] p-6">
          <ProsCons pros={product.pros} cons={product.cons} />
        </div>
      </section>

      <section className="mt-12">
        <ProductCard product={product} layout="split" />
      </section>

      {article.contentHtml ? (
        <div
          className="prose prose-smartdesk mt-14 max-w-none prose-headings:font-[family-name:var(--font-display)]"
          dangerouslySetInnerHTML={{ __html: article.contentHtml }}
        />
      ) : null}

      <aside className="mt-12 rounded-2xl bg-[var(--ink)] px-6 py-8 text-white sm:px-8">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-medium">
          Ready to buy?
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">
          Compare the latest price and availability on Amazon. We may earn a
          commission from qualifying purchases.
        </p>
        <div className="mt-6">
          <AffiliateButton
            href={product.amazonUrl}
            label="View on Amazon"
            variant="light"
          />
        </div>
      </aside>

      <div className="mt-14">
        <FAQ items={article.faq} />
      </div>

      <InternalLinks
        className="mt-14"
        links={article.related}
        posts={relatedPosts}
      />
    </article>
  );
}
