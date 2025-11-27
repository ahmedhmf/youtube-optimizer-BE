export type AuditTableModel = {
  id: string;
  user_id: string;
  video_url: string;
  video_title: string;
  ai_titles: string[];
  ai_description: string;
  ai_tags: string[];
  created_at: string;
  thumbnail_url: string;
  ai_image_prompt: string;
};
