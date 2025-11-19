import { AiMessageConfiguration } from 'src/auth/types/ai-configuration.model';

export interface VideoAnalysisJob {
  userId: string;
  email: string;
  jobId: string;
  type: 'youtube' | 'upload' | 'transcript';
  configuration?: AiMessageConfiguration;
  fileData?: {
    buffer: Buffer;
    originalName: string;
    mimetype: string;
  };
  transcript?: string;
  accessToken?: string;
  video_title?: string;
}
