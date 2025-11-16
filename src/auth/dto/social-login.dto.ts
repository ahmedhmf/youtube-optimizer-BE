import { IsString, IsOptional } from 'class-validator';

export enum SocialProvider {
  GOOGLE = 'google',
  GITHUB = 'github',
}

export class GoogleLoginDto {
  @IsString()
  token: string; // Google ID token
}

export class GitHubLoginDto {
  @IsString()
  code: string; // GitHub authorization code
}

// For the controller endpoints - allows both fields but only validates what's present
export class SocialLoginRequestDto {
  @IsOptional()
  @IsString()
  token?: string; // Google ID token
  
  @IsOptional()
  @IsString()
  code?: string; // GitHub authorization code

  @IsOptional()
  @IsString()
  provider?: string; // Allow provider field from frontend
}

// Generic DTO for internal use
export class SocialLoginDto {
  token?: string;
  code?: string;
  provider: SocialProvider;
}

export interface SocialUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: SocialProvider;
}

export interface GoogleTokenPayload {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  email_verified: boolean;
  aud: string; // audience - client ID
}

export interface GitHubUserResponse {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}