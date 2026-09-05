export const siteConfig = {
  name: "SmartDeskSetup",
  tagline: "Create your perfect small home office",
  description:
    "Smart guides and expert recommendations to build a productive workspace in any small room. Honest reviews for apartments and compact home offices.",
  url: "https://smartdesk.validateidea.org",
  locale: "en_US",
  author: "SmartDeskSetup Editorial",
  affiliateTag: "smartdesksetup-20",
  email: "hello@smartdesksetup.com",
  social: {
    twitter: "@smartdesksetup",
  },
} as const;

export function absoluteUrl(path = "") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${siteConfig.url}${normalized === "/" ? "" : normalized}`;
}
