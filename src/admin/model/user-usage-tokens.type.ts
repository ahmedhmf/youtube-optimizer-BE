export type UserUsageToken = {
  id: string;
  user_id: string;
  feature_type: string;
  tokens_consumed: number;
  request_count: number;
  created_at: string;
  metadata: object | null;
};
