import Image from "next/image";
import Link from "next/link";
import type { PostMeta } from "@/lib/posts";

type GuideCardProps = {
  post: PostMeta;
};

export function GuideCard({ post }: GuideCardProps) {
  const imageSrc = post.coverImage ?? "/images/guide-placeholder.svg";

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] transition duration-300 hover:-translate-y-1 hover:border-[var(--line-strong)] hover:shadow-[0_20px_50px_-30px_rgba(17,17,17,0.28)]">
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--canvas)]">
        <Image
          src={imageSrc}
          alt=""
          fill
          unoptimized
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      </div>

      <div className="flex flex-1 flex-col p-6">
        <time
          dateTime={post.date}
          className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--subtle)]"
        >
          {new Date(post.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </time>
        <h3 className="mt-3 font-[family-name:var(--font-display)] text-xl font-medium leading-snug text-[var(--ink)]">
          <Link href={`/blog/${post.slug}`} className="transition hover:opacity-70">
            {post.title}
          </Link>
        </h3>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--muted)]">
          {post.description}
        </p>
        <Link
          href={`/blog/${post.slug}`}
          className="mt-5 inline-flex text-sm font-semibold text-[var(--ink)] transition group-hover:translate-x-0.5"
        >
          Read more
          <span aria-hidden className="ml-1">
            →
          </span>
        </Link>
      </div>
    </article>
  );
}
