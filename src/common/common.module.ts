import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecurityConfigService } from './security-config.service';
import { SecurityController } from './security.controller';
import { SecurityMiddleware } from './security.middleware';
import { EnvironmentService } from './environment.service';
import { InputSanitizationService } from './input-sanitization.service';
import { ValidationAndSanitizationPipe } from './validation-sanitization.pipe';
import { AuditLoggingService } from './audit-logging.service';
import { SecurityAuditController } from './security-audit.controller';
import { PasswordBreachService } from './password-breach.service';
import { PasswordSecurityService } from './password-security.service';
import { PasswordSecurityController } from './password-security.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule, ConfigModule],
  providers: [
    SecurityConfigService,
    SecurityMiddleware,
    EnvironmentService,
    InputSanitizationService,
    ValidationAndSanitizationPipe,
    AuditLoggingService,
    PasswordBreachService,
    PasswordSecurityService,
  ],
  controllers: [
    SecurityController,
    SecurityAuditController,
    PasswordSecurityController,
  ],
  exports: [
    SecurityConfigService,
    SecurityMiddleware,
    AuditLoggingService,
    PasswordBreachService,
    PasswordSecurityService,
    EnvironmentService,
    InputSanitizationService,
    ValidationAndSanitizationPipe,
  ],
})
export class CommonModule {}
