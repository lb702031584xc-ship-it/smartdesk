import { ComparisonTemplate } from "@/components/article/templates/ComparisonTemplate";
import { GuideTemplate } from "@/components/article/templates/GuideTemplate";
import { RankingTemplate } from "@/components/article/templates/RankingTemplate";
import { ReviewTemplate } from "@/components/article/templates/ReviewTemplate";
import type { ArticleMeta, ResolvedArticle } from "@/types/article";

type ArticleTemplateRendererProps = {
  article: ResolvedArticle;
  categoryName?: string;
  categoryHref?: string;
  relatedPosts?: ArticleMeta[];
};

export function ArticleTemplateRenderer({
  article,
  categoryName,
  categoryHref,
  relatedPosts,
}: ArticleTemplateRendererProps) {
  const shared = {
    article,
    categoryName,
    categoryHref,
    relatedPosts,
  };

  switch (article.type) {
    case "best":
      return <RankingTemplate {...shared} />;
    case "review":
      return <ReviewTemplate {...shared} />;
    case "comparison":
      return <ComparisonTemplate {...shared} />;
    default:
      return <GuideTemplate {...shared} />;
  }
}
