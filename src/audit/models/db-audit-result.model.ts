export type DBAuditResultModel = {
  error: null;
  data: {
    id: string;
    user_id: string;
    video_url: string;
    video_title: string;
    thumbnail_url: string;
    ai_titles_with_reasoning: {
      titles: string[];
      reasoning: string;
    };
    ai_description_detailed: {
      description: string;
      hashtags: string[];
      keyPoints: string[];
    };
    ai_keywords_categorized: {
      primaryKeywords: string[];
      longTailKeywords: string[];
      trendingKeywords: string[];
      competitorKeywords: string[];
    };
    ai_chapters: {
      chapters: Array<{
        title: string;
        timestamp: string;
        description: string;
      }>;
      totalDuration: string;
    };
    ai_thumbnail_ideas: string[];
    ai_thumbnail_ai_prompts: string[];
    created_at: string;
  };
  count: number | null;
  status: number;
  statusText: string;
};
