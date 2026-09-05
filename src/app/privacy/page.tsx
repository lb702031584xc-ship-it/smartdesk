import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${siteConfig.name} collects, uses, and protects visitor information.`,
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--ink)]">
        Privacy Policy
      </h1>
      <p className="mt-3 text-sm text-[var(--muted)]">Last updated: August 16, 2026</p>

      <div className="prose prose-smartdesk mt-10 max-w-none">
        <p>
          {siteConfig.name} (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
          operates this website to publish home office guides and product
          recommendations. This Privacy Policy explains what information we may
          collect and how we use it.
        </p>

        <h2>Information we collect</h2>
        <p>
          We may collect limited technical information automatically when you
          visit the site, such as browser type, device type, referring pages,
          and approximate location derived from IP address. If you contact us by
          email, we collect the information you choose to send.
        </p>

        <h2>Cookies and analytics</h2>
        <p>
          We may use first-party cookies and third-party analytics tools to
          understand traffic patterns and improve content. You can control
          cookies through your browser settings. Disabling cookies may affect
          some site features.
        </p>

        <h2>Affiliate and advertising partners</h2>
        <p>
          Some links on this site are affiliate links, including Amazon
          Associates links. Partners may use cookies or similar technologies to
          track referrals. Purchases made through those links may generate a
          commission for us. See our{" "}
          <Link href="/affiliate-disclosure">Affiliate Disclosure</Link> for
          details.
        </p>

        <h2>How we use information</h2>
        <ul>
          <li>Operate and improve the website</li>
          <li>Measure content performance</li>
          <li>Respond to inquiries</li>
          <li>Maintain security and prevent abuse</li>
        </ul>

        <h2>Data sharing</h2>
        <p>
          We do not sell personal information. We may share limited data with
          service providers that help us host, analyze, or operate the site, and
          when required by law.
        </p>

        <h2>Your choices</h2>
        <p>
          You may request access to or deletion of personal information you have
          provided by contacting us. Depending on your location, additional
          privacy rights may apply.
        </p>

        <h2>Children&apos;s privacy</h2>
        <p>
          This website is not directed to children under 13, and we do not
          knowingly collect personal information from children.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          We may update this Privacy Policy from time to time. The &quot;Last
          updated&quot; date at the top of this page reflects the latest
          revision.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy can be sent to privacy@
          {siteConfig.url.replace("https://", "")}.
        </p>
      </div>
    </div>
  );
}
