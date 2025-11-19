import { Module } from '@nestjs/common';
import { SecurityConfigService } from './security-config.service';
import { SecurityController } from './security.controller';
import { SecurityMiddleware } from './security.middleware';
import { EnvironmentService } from './environment.service';
import { InputSanitizationService } from './input-sanitization.service';
import { ValidationAndSanitizationPipe } from './validation-sanitization.pipe';

@Module({
  providers: [
    SecurityConfigService,
    SecurityMiddleware,
    EnvironmentService,
    InputSanitizationService,
    ValidationAndSanitizationPipe,
  ],
  controllers: [SecurityController],
  exports: [
    SecurityConfigService,
    SecurityMiddleware,
    EnvironmentService,
    InputSanitizationService,
    ValidationAndSanitizationPipe,
  ],
})
export class CommonModule {}
