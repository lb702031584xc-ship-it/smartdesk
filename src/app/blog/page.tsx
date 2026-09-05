import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { GuideCard } from "@/components/GuideCard";
import { SectionHeading } from "@/components/SectionHeading";
import { getAllPosts } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Home Office Setup Guides",
  description:
    "Practical guides for compact desks, ergonomic seating, lighting, and clutter-free small home offices.",
  alternates: {
    canonical: "/blog",
  },
};

export default async function BlogIndexPage() {
  const posts = await getAllPosts();

  return (
    <Container className="py-16 sm:py-20">
      <SectionHeading
        eyebrow="Guides"
        title="Setup guides for small home offices"
        description="Layout strategies, product shortlists, and buying criteria for rooms that share space with living, sleeping, or dining."
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <GuideCard key={post.slug} post={post} />
        ))}
      </div>
    </Container>
  );
}
