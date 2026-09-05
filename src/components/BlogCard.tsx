import Link from "next/link";
import type { PostMeta } from "@/lib/posts";
import { getCategoryBySlug } from "@/lib/categories";

type BlogCardProps = {
  post: PostMeta;
};

export function BlogCard({ post }: BlogCardProps) {
  const category = getCategoryBySlug(post.category);

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 transition duration-300 hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:shadow-[0_16px_36px_-28px_rgba(17,17,17,0.28)]">
      <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.14em] text-[var(--subtle)]">
        <Link
          href={`/category/${post.category}`}
          className="text-[var(--ink)] hover:opacity-70"
        >
          {category?.name ?? post.category}
        </Link>
        <span aria-hidden>•</span>
        <time dateTime={post.date}>
          {new Date(post.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </time>
      </div>

      <h3 className="mt-3 font-[family-name:var(--font-display)] text-xl font-medium leading-snug text-[var(--ink)]">
        <Link href={`/blog/${post.slug}`} className="hover:opacity-70">
          {post.title}
        </Link>
      </h3>

      <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--muted)]">
        {post.description}
      </p>

      <div className="mt-5 flex items-center justify-between text-sm">
        <span className="text-[var(--subtle)]">{post.readingTime}</span>
        <Link
          href={`/blog/${post.slug}`}
          className="font-semibold text-[var(--ink)] transition group-hover:translate-x-0.5"
        >
          Read more →
        </Link>
      </div>
    </article>
  );
}
