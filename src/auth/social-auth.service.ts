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
}
