export interface RefreshTokenData {
  token: string;
  user_id: string;
  expires_at: Date;
  device_id?: string;
  is_revoked: boolean;
}
