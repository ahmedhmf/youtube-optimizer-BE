export type AccountLockout = {
  userId: string;
  identifier: string;
  failed_attempts: number;
  first_failure_at: string;
  last_failure_at: string;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
};
