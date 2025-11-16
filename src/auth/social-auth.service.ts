import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  SocialProvider,
  SocialUserInfo,
  GoogleTokenPayload,
  GitHubUserResponse,
} from './dto/social-login.dto';

@Injectable()
export class SocialAuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async validateGoogleToken(token: string): Promise<SocialUserInfo> {
    try {
      // Verify Google ID token
      const response = await firstValueFrom(
        this.httpService.get(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`,
        ),
      );

      const payload: GoogleTokenPayload = response.data;

      // Verify the token is for our app
      const expectedClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
      if (payload.aud !== expectedClientId) {
        throw new BadRequestException('Invalid Google token audience');
      }

      if (!payload.email_verified) {
        throw new BadRequestException('Google email not verified');
      }

      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        provider: SocialProvider.GOOGLE,
      };
    } catch (error) {
      throw new BadRequestException('Invalid Google token');
    }
  }

  async validateGitHubCode(code: string): Promise<SocialUserInfo> {
    try {
      // Exchange code for access token
      const tokenResponse = await firstValueFrom(
        this.httpService.post(
          'https://github.com/login/oauth/access_token',
          {
            client_id: this.configService.get<string>('GITHUB_CLIENT_ID'),
            client_secret: this.configService.get<string>('GITHUB_CLIENT_SECRET'),
            code,
          },
          {
            headers: {
              Accept: 'application/json',
            },
          },
        ),
      );

      const { access_token } = tokenResponse.data;

      if (!access_token) {
        throw new BadRequestException('Failed to get GitHub access token');
      }

      // Get user information
      const userResponse = await firstValueFrom(
        this.httpService.get<GitHubUserResponse>('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${access_token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }),
      );

      const user = userResponse.data;

      // Get user email if not public
      let email = user.email;
      if (!email) {
        const emailResponse = await firstValueFrom(
          this.httpService.get('https://api.github.com/user/emails', {
            headers: {
              Authorization: `Bearer ${access_token}`,
              Accept: 'application/vnd.github.v3+json',
            },
          }),
        );
        
        const primaryEmail = emailResponse.data.find((e: any) => e.primary);
        email = primaryEmail?.email;
      }

      if (!email) {
        throw new BadRequestException('GitHub account must have a verified email');
      }

      return {
        id: user.id.toString(),
        email,
        name: user.name || user.login,
        picture: user.avatar_url,
        provider: SocialProvider.GITHUB,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Invalid GitHub authorization code');
    }
  }
}