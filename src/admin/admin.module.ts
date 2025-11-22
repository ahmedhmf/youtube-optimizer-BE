import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { CommonModule } from 'src/common/common.module';
import { HttpModule } from '@nestjs/axios';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { AccountLockoutService } from 'src/auth/account-lockout.service';
import { AuthService } from 'src/auth/auth.service';
import { CSRFGuard } from 'src/auth/guards/csrf.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { LockoutCleanupService } from 'src/auth/lockout-cleanup.service';
import { SessionSecurityService } from 'src/auth/session-security.service';
import { SocialAuthService } from 'src/auth/social-auth.service';
import { TokenBlacklistService } from 'src/auth/token-blacklist.service';
import { CSRFService } from 'src/common/csrf.service';
import { AdminService } from './admin.service';
import { JwtModule, JwtService } from '@nestjs/jwt';

@Module({
  imports: [SupabaseModule, HttpModule, CommonModule, JwtModule],
  controllers: [AdminController],
  providers: [
    AuthService,
    JwtService,
    RolesGuard,
    SocialAuthService,
    AccountLockoutService,
    LockoutCleanupService,
    SessionSecurityService,
    TokenBlacklistService,
    CSRFService,
    CSRFGuard,
    AdminService,
  ],
  exports: [AdminService],
})
export class AdminModule {}
