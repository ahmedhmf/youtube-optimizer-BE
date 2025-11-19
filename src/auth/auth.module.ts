import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { AdminController } from './admin.controller';
import { RolesGuard } from './guards/roles.guard';
import { SocialAuthService } from './social-auth.service';
import { AccountLockoutService } from './account-lockout.service';
import { LockoutCleanupService } from './lockout-cleanup.service';
import { SessionSecurityService } from './session-security.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { CSRFService } from '../common/csrf.service';
import { CSRFGuard } from './guards/csrf.guard';
import { CSRFController } from './csrf.controller';
import { TokenBlacklistService } from './token-blacklist.service';
import { TokenTestController } from './token-test.controller';

@Module({
  imports: [
    SupabaseModule,
    HttpModule,
    ScheduleModule.forRoot(),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret =
          configService.get<string>('JWT_SECRET') || 'fallback-secret-key';
        return {
          secret,
          signOptions: { expiresIn: '15m' },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, AdminController, CSRFController, TokenTestController],
  providers: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    SocialAuthService,
    AccountLockoutService,
    LockoutCleanupService,
    SessionSecurityService,
    TokenBlacklistService,
    CSRFService,
    CSRFGuard,
  ],
  exports: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    SocialAuthService,
    AccountLockoutService,
    TokenBlacklistService,
    PassportModule,
  ],
})
export class AuthModule {}
