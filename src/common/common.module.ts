import { Module } from '@nestjs/common';
import { SecurityConfigService } from './security-config.service';
import { SecurityController } from './security.controller';
import { SecurityMiddleware } from './security.middleware';
import { EnvironmentService } from './environment.service';

@Module({
  providers: [SecurityConfigService, SecurityMiddleware, EnvironmentService],
  controllers: [SecurityController],
  exports: [SecurityConfigService, SecurityMiddleware, EnvironmentService],
})
export class CommonModule {}
