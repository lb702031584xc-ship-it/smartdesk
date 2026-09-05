export type Category = {
  slug: string;
  name: string;
  description: string;
  shortDescription: string;
};

export const categories: Category[] = [
  {
    slug: "desks",
    name: "Compact Desks",
    description:
      "Space-saving desks, wall-mounted options, and corner setups built for small rooms and apartments.",
    shortDescription: "Desks that fit tight corners and studio apartments.",
  },
  {
    slug: "chairs",
    name: "Ergonomic Chairs",
    description:
      "Supportive seating for long workdays without oversized office-chair footprints.",
    shortDescription: "Comfortable chairs that do not dominate the room.",
  },
  {
    slug: "monitors",
    name: "Monitors & Stands",
    description:
      "Displays, arms, and risers that expand screen space while keeping the desk clear.",
    shortDescription: "Better screens and smarter mounting for small desks.",
  },
  {
    slug: "storage",
    name: "Cable & Storage",
    description:
      "Cable management, drawers, and vertical organizers that keep tiny workspaces calm.",
    shortDescription: "Declutter tools for tidy, focused setups.",
  },
  {
    slug: "lighting",
    name: "Desk Lighting",
    description:
      "Task lamps and bias lighting that reduce eye strain in rooms without ideal natural light.",
    shortDescription: "Clear, glare-controlled light for focused work.",
  },
];

export function getCategoryBySlug(slug: string) {
  return categories.find((category) => category.slug === slug);
}
