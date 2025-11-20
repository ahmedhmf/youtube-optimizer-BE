export interface SecurityEvent {
  id: string;
  user_id: string;
  event_type: string;
  event_category: string;
  severity: string;
  ip_address?: string;
  user_agent?: string;
  device_id?: string;
  resource_type?: string;
  resource_id?: string;
  action?: string;
  status: string;
  metadata: Record<string, any>;
  request_id?: string;
  created_at: string;
  updated_at: string;
}
