// apps/api/src/modules/audit/audit.types.ts
import { YouTubeVideo } from '../../youtube/youtube.types';
import { AiSuggestions } from '../../ai/models/ai.types';

export interface AuditResponse {
  video: YouTubeVideo;
  suggestions: AiSuggestions;
}
