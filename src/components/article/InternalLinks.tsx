import Link from "next/link";
import type { ArticleMeta, InternalLink } from "@/types/article";

type InternalLinksProps = {
  title?: string;
  links?: InternalLink[];
  posts?: ArticleMeta[];
  className?: string;
};

export function InternalLinks({
  title = "Keep reading",
  links = [],
  posts = [],
  className = "",
}: InternalLinksProps) {
  const items: InternalLink[] =
    links.length > 0
      ? links
      : posts.map((post) => ({
          title: post.title,
          href: `/blog/${post.slug}`,
          description: post.description,
        }));

  if (!items.length) return null;

  return (
    <aside className={`border-t border-[var(--line)] pt-10 ${className}`}>
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-medium tracking-tight text-[var(--ink)]">
        {title}
      </h2>
      <ul className="mt-5 grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="group block rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 transition duration-300 hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:shadow-[0_16px_36px_-28px_rgba(17,17,17,0.25)]"
            >
              <p className="font-medium text-[var(--ink)] transition group-hover:opacity-70">
                {item.title}
              </p>
              {item.description ? (
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                  {item.description}
                </p>
              ) : null}
              <span className="mt-3 inline-flex text-sm font-semibold text-[var(--ink)]">
                Read →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
