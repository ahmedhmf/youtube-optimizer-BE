import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  SocialProvider,
  SocialUserInfo,
  GoogleTokenPayload,
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
        this.httpService.get<GoogleTokenPayload>(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`,
        ),
      );

      const payload = response.data;

      // Verify the token is for our app
      const expectedClientId =
        this.configService.get<string>('GOOGLE_CLIENT_ID');
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
    } catch {
      throw new BadRequestException('Invalid Google token');
    }
  }

  /**
   * Exchange Google authorization code for access token and user info
   */
  async exchangeGoogleCode(code: string): Promise<SocialUserInfo> {
    try {
      const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
      const clientSecret = this.configService.get<string>(
        'GOOGLE_CLIENT_SECRET',
      );
      const redirectUri =
        this.configService.get<string>('GOOGLE_REDIRECT_URI') ||
        `${this.configService.get<string>('BACKEND_URL')}/auth/social/google`;

      // 1. Exchange authorization code for tokens
      const tokenResponse = await firstValueFrom(
        this.httpService.post<{
          access_token: string;
          expires_in: number;
          refresh_token?: string;
          scope: string;
          token_type: string;
          id_token?: string;
        }>('https://oauth2.googleapis.com/token', {
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      );

      const { access_token } = tokenResponse.data;

      // 2. Get user info from Google
      const userInfoResponse = await firstValueFrom(
        this.httpService.get<{
          id: string;
          email: string;
          verified_email: boolean;
          name: string;
          given_name?: string;
          family_name?: string;
          picture?: string;
          locale?: string;
        }>('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${access_token}` },
        }),
      );

      const userInfo = userInfoResponse.data;

      // Verify email is verified
      if (!userInfo.verified_email) {
        throw new BadRequestException('Google email not verified');
      }

      return {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        provider: SocialProvider.GOOGLE,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to exchange Google code: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
