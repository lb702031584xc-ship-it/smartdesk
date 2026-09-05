import type {
  ArticleSearchIntent,
  ArticleV1,
  ArticleV1Type,
} from "@/types/article-v1";

/**
 * Smallest editable Article V1 candidate.
 * Status is always draft. Type and intent stay empty until explicitly chosen.
 */
export function blankArticleV1(): ArticleV1 {
  return {
    identity: {
      id: "",
      title: "",
      slug: "",
    },
    classification: {
      type: "" as ArticleV1Type,
    },
    editorial: {
      intent: "" as ArticleSearchIntent,
    },
    publishing: {
      status: "draft",
      featured: false,
    },
  };
}
