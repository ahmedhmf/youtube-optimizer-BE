// apps/api/src/modules/youtube/youtube.types.ts
export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  tags: string[];
  thumbnail: string;
  publishedAt: string;
  duration: string;
  views: number;
  likes: number;
  comments: number;
}
