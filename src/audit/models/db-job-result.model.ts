import { AiMessageConfiguration } from 'src/auth/types/ai-configuration.model';
import { FilgeDataModel } from './file-data.model';

export type DBJobResultModel = {
  id: number;
  user_id: string | null;
  job_type: string | null;
  status: string | null;
  payload: {
    type: string | null;
    email: string | null;
    jobId: string | null;
    userId: string | null;
    video_title: string | null;
    configuration: AiMessageConfiguration | null;
    accessToken: string | null;
    transcript: string | null;
    fileData: FilgeDataModel | null;
  };
  result: string | null;
  error_message: string | null;
  progress: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};
