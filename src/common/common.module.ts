import { Module } from '@nestjs/common';
import { SecurityConfigService } from './security-config.service';
import { SecurityController } from './security.controller';
import { SecurityMiddleware } from './security.middleware';
import { EnvironmentService } from './environment.service';
import { InputSanitizationService } from './input-sanitization.service';
import { ValidationAndSanitizationPipe } from './validation-sanitization.pipe';
import { AuditLoggingService } from './audit-logging.service';
import { SecurityAuditController } from './security-audit.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [
    SecurityConfigService,
    SecurityMiddleware,
    EnvironmentService,
    InputSanitizationService,
    ValidationAndSanitizationPipe,
    AuditLoggingService,
  ],
  controllers: [SecurityController, SecurityAuditController],
  exports: [
    SecurityConfigService,
    SecurityMiddleware,
    AuditLoggingService,
    EnvironmentService,
    InputSanitizationService,
    ValidationAndSanitizationPipe,
  ],
})
export class CommonModule {}
