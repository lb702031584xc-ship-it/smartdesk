import type { Metadata } from "next";
import { CategorySection } from "@/components/home/CategorySection";
import { FeaturedProductsSection } from "@/components/home/FeaturedProductsSection";
import { HeroSection } from "@/components/home/HeroSection";
import { LatestGuidesSection } from "@/components/home/LatestGuidesSection";
import { MissionSection } from "@/components/home/MissionSection";
import { NewsletterSection } from "@/components/home/NewsletterSection";
import { ReviewProcessSection } from "@/components/home/ReviewProcessSection";
import { TrustSection } from "@/components/home/TrustSection";
import { getAllPosts } from "@/lib/posts";
import { getFeaturedProducts } from "@/lib/products";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Create Your Perfect Small Home Office",
  description: siteConfig.description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `Create Your Perfect Small Home Office | ${siteConfig.name}`,
    description: siteConfig.description,
    url: siteConfig.url,
  },
};

export default async function HomePage() {
  const products = await getFeaturedProducts(4);
  const posts = (await getAllPosts()).slice(0, 3);

  return (
    <>
      <HeroSection />
      <CategorySection />
      <FeaturedProductsSection products={products} />
      <LatestGuidesSection posts={posts} />
      <ReviewProcessSection />
      <MissionSection />
      <TrustSection />
      <NewsletterSection />
    </>
  );
}
