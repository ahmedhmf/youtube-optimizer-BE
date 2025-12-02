import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { CommonModule } from 'src/common/common.module';
import { HttpModule } from '@nestjs/axios';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { NotificationModule } from 'src/notifications/notification.module';
import { AuthService } from 'src/auth/auth.service';
import { CSRFGuard } from 'src/auth/guards/csrf.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { SocialAuthService } from 'src/auth/social-auth.service';
import { CSRFService } from 'src/common/csrf.service';
import { AdminService } from './admin.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { InvitationService } from 'src/auth/invitation.service';

@Module({
  imports: [SupabaseModule, HttpModule, CommonModule, JwtModule, NotificationModule],
  controllers: [AdminController],
  providers: [
    AuthService,
    JwtService,
    RolesGuard,
    SocialAuthService,
    CSRFService,
    CSRFGuard,
    AdminService,
    InvitationService,
  ],
  exports: [AdminService],
})
export class AdminModule {}
