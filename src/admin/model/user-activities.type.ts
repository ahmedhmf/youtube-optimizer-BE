export type UserActivities = {
  id: string;
  user_id: string;
  activity_type: string;
  description: string;
  metadata: object | null;
  created_at: string;
};
