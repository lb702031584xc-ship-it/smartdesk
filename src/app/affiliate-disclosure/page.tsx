import type { Metadata } from "next";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Affiliate Disclosure",
  description:
    "How SmartDeskSetup uses Amazon Associates and other affiliate links, and what that means for readers.",
  alternates: {
    canonical: "/affiliate-disclosure",
  },
};

export default function AffiliateDisclosurePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--ink)]">
        Affiliate Disclosure
      </h1>
      <p className="mt-3 text-sm text-[var(--muted)]">Last updated: August 16, 2026</p>

      <div className="prose prose-smartdesk mt-10 max-w-none">
        <p>
          {siteConfig.name} participates in the Amazon Services LLC Associates
          Program, an affiliate advertising program designed to provide a means
          for sites to earn advertising fees by advertising and linking to
          Amazon.com and related sites.
        </p>

        <h2>What this means for you</h2>
        <p>
          When you click an affiliate link and make a qualifying purchase, we
          may earn a commission. This does not change the price you pay. We only
          recommend products we believe can help readers improve a small home
          office setup.
        </p>

        <h2>How we choose products</h2>
        <p>
          Editorial recommendations are based on space constraints, ergonomics,
          build quality, value, and real-world usability for apartments and
          shared rooms. Affiliate compensation may influence which retailers we
          link to, but it does not determine our honest assessment of a product.
        </p>

        <h2>Amazon trademarks</h2>
        <p>
          Amazon, Amazon.com, and the Amazon logo are trademarks of Amazon.com,
          Inc. or its affiliates. {siteConfig.name} is not affiliated with
          Amazon beyond participation in the Associates Program.
        </p>

        <h2>Other affiliate relationships</h2>
        <p>
          From time to time we may also participate in other affiliate programs.
          When we do, we will disclose material connections in a clear manner on
          relevant pages.
        </p>

        <h2>Questions</h2>
        <p>
          If you have questions about our affiliate relationships, contact us at
          hello@{siteConfig.url.replace("https://", "")}.
        </p>
      </div>
    </div>
  );
}
