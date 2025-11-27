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
import { IPRateLimitService } from './ip-rate-limit.service';
import { IPRateLimitMiddleware } from './ip-rate-limit.middleware';
import { IPRateLimitController } from './ip-rate-limit.controller';
import { UserFeedbackService } from './user-feedback.service';
import { UserFeedbackController } from './user-feedback.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { EnvValidationService } from './env-validation.service';

@Module({
  imports: [SupabaseModule, ConfigModule],
  providers: [
    SecurityConfigService,
    SecurityMiddleware,
    EnvironmentService,
    EnvValidationService,
    InputSanitizationService,
    ValidationAndSanitizationPipe,
    AuditLoggingService,
    PasswordBreachService,
    PasswordSecurityService,
    IPRateLimitService,
    IPRateLimitMiddleware,
    UserFeedbackService,
  ],
  controllers: [
    SecurityController,
    SecurityAuditController,
    PasswordSecurityController,
    IPRateLimitController,
    UserFeedbackController,
  ],
  exports: [
    SecurityConfigService,
    SecurityMiddleware,
    AuditLoggingService,
    PasswordBreachService,
    PasswordSecurityService,
    IPRateLimitService,
    IPRateLimitMiddleware,
    UserFeedbackService,
    EnvironmentService,
    EnvValidationService,
    InputSanitizationService,
    ValidationAndSanitizationPipe,
  ],
})
export class CommonModule {}
