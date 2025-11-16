import { UserRole } from '../types/roles.types';
import { SocialProvider } from '../dto/social-login.dto';

export interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  picture?: string;
  provider?: SocialProvider | 'email';
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}