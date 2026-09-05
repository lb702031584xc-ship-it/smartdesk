import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AffiliateDisclaimer } from "@/components/AffiliateDisclaimer";
import { BlogCard } from "@/components/BlogCard";
import { ProductCard } from "@/components/ProductCard";
import {
  categories,
  getCategoryBySlug,
} from "@/lib/categories";
import { getPostsByCategory } from "@/lib/posts";
import { getProductsByCategory } from "@/lib/products";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  if (!category) {
    return { title: "Category not found" };
  }

  return {
    title: category.name,
    description: category.description,
    alternates: {
      canonical: `/category/${category.slug}`,
    },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const products = await getProductsByCategory(category.slug);
  const posts = await getPostsByCategory(category.slug);

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--subtle)]">
          Category
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-medium tracking-tight text-[var(--ink)]">
          {category.name}
        </h1>
        <p className="mt-4 text-[var(--muted)]">{category.description}</p>
      </header>

      <div className="mt-8">
        <AffiliateDisclaimer />
      </div>

      <section className="mt-12">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-medium text-[var(--ink)]">
          Recommended products
        </h2>
        {products.length > 0 ? (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-[var(--muted)]">
            Product picks for this category are coming soon.
          </p>
        )}
      </section>

      <section className="mt-16">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-medium text-[var(--ink)]">
            Related guides
          </h2>
          <Link
            href="/blog"
            className="text-sm font-semibold text-[var(--ink)] hover:opacity-70"
          >
            All guides →
          </Link>
        </div>
        {posts.length > 0 ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {posts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-[var(--muted)]">
            No guides in this category yet.
          </p>
        )}
      </section>
    </div>
  );
}
