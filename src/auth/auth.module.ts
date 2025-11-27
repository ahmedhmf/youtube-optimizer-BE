import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { SocialAuthService } from './social-auth.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { CSRFService } from '../common/csrf.service';
import { CSRFGuard } from './guards/csrf.guard';
import { CSRFController } from './csrf.controller';
import { CommonModule } from '../common/common.module';
import { AdminService } from '../admin/admin.service';

@Module({
  imports: [
    SupabaseModule,
    HttpModule,
    CommonModule,
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
  controllers: [AuthController, CSRFController],
  providers: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    SocialAuthService,
    CSRFService,
    CSRFGuard,
    AdminService,
  ],
  exports: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    SocialAuthService,
    PassportModule,
    AdminService,
  ],
})
export class AuthModule {}
