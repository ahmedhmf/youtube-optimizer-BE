import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { AdminController } from './admin.controller';
import { RolesGuard } from './guards/roles.guard';
import { SocialAuthService } from './social-auth.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [
    SupabaseModule,
    HttpModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret =
          configService.get<string>('JWT_SECRET') || 'fallback-secret-key';
        console.log(
          'JwtModule - Using secret:',
          secret.substring(0, 10) + '...',
        );
        return {
          secret,
          signOptions: { expiresIn: '15m' },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, AdminController],
  providers: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    SocialAuthService,
  ],
  exports: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    SocialAuthService,
    PassportModule,
  ],
})
export class AuthModule {}
