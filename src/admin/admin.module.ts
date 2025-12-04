import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { CommonModule } from 'src/common/common.module';
import { HttpModule } from '@nestjs/axios';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { NotificationModule } from 'src/notifications/notification.module';
import { AuthService } from 'src/auth/auth.service';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { SocialAuthService } from 'src/auth/social-auth.service';
import { AdminService } from './admin.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { InvitationService } from 'src/auth/invitation.service';
import { UserPreferencesModule } from 'src/user-preferences/user-preferences.module';

@Module({
  imports: [
    SupabaseModule,
    HttpModule,
    CommonModule,
    JwtModule,
    NotificationModule,
    UserPreferencesModule,
  ],
  controllers: [AdminController],
  providers: [
    AuthService,
    JwtService,
    RolesGuard,
    SocialAuthService,
    AdminService,
    InvitationService,
  ],
  exports: [AdminService],
})
export class AdminModule {}
