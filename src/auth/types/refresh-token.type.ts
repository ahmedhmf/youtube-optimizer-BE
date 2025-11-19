export type RefreshTokens = {
  id: string;
  token: string;
  user_id: string;
  session_id: string | null;
  device_id: string | null;
  expires_at: string;
  created_at: string | null;
  updated_at: string | null;
};
