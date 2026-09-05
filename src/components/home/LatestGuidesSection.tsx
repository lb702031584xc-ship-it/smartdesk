import Link from "next/link";
import { Container } from "@/components/Container";
import { GuideCard } from "@/components/GuideCard";
import { SectionHeading } from "@/components/SectionHeading";
import type { PostMeta } from "@/lib/posts";

type LatestGuidesSectionProps = {
  posts: PostMeta[];
};

export function LatestGuidesSection({ posts }: LatestGuidesSectionProps) {
  return (
    <section aria-labelledby="guides-heading" className="py-16 sm:py-20">
      <Container>
        <SectionHeading
          id="guides-heading"
          eyebrow="Guides"
          title="Latest setup guides"
          description="Practical layouts and buying notes for apartments, spare rooms, and multi-use desks."
          action={
            <Link
              href="/blog"
              className="text-sm font-semibold text-[var(--ink)] transition hover:opacity-70"
            >
              Browse all guides →
            </Link>
          }
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <GuideCard key={post.slug} post={post} />
          ))}
        </div>
      </Container>
    </section>
  );
}
