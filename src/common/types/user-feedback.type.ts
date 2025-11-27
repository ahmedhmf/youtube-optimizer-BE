export type UserFeedbackModel = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  description: string;
  priority: string | null;
  tags: string[] | null;
  currentPage: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};
