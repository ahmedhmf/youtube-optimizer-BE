import { Module } from '@nestjs/common';
import { SecurityConfigService } from './security-config.service';
import { SecurityController } from './security.controller';
import { SecurityMiddleware } from './security.middleware';

@Module({
  providers: [SecurityConfigService, SecurityMiddleware],
  controllers: [SecurityController],
  exports: [SecurityConfigService, SecurityMiddleware],
})
export class CommonModule {}