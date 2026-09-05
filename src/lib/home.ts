export type HomeCategory = {
  slug: string;
  title: string;
  description: string;
  href: string;
};

export const homeCategories: HomeCategory[] = [
  {
    slug: "small-desk-ideas",
    title: "Small Desk Ideas",
    description:
      "Find compact desks and layouts designed for apartments and small rooms.",
    href: "/category/desks",
  },
  {
    slug: "ergonomic-seating",
    title: "Ergonomic Seating",
    description:
      "Discover comfortable seating solutions for long work sessions.",
    href: "/category/chairs",
  },
  {
    slug: "space-saving-solutions",
    title: "Space-Saving Solutions",
    description:
      "Smart ideas to create a workspace without needing extra space.",
    href: "/category/storage",
  },
  {
    slug: "productivity-setup",
    title: "Productivity Setup",
    description:
      "Build a focused and efficient workspace with practical tools.",
    href: "/blog",
  },
];
