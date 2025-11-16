import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import * as bodyParser from 'body-parser';
import helmet from 'helmet';
import { SecurityConfigService } from './common/security-config.service';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Initialize security configuration
  const securityConfig = new SecurityConfigService();
  
  // Security headers with Helmet
  app.use(helmet(securityConfig.getSecurityConfig()));

  // Enable CORS with environment-aware configuration
  app.enableCors(securityConfig.getCorsConfig());

  // Enable validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Body parser for large payloads
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
