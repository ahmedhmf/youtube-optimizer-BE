export interface SessionData {
  id: string;
  user_id: string;
  email: string;
  role: string;
  device_id?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
  last_activity: Date;
}
