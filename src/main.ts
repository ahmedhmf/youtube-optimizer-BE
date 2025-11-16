import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import * as bodyParser from 'body-parser';
import helmet from 'helmet';
import { EnvironmentService } from './common/environment.service';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get environment service from the application context
  const environmentService = app.get(EnvironmentService);
  
  // Security headers with Helmet
  app.use(helmet(environmentService.getSecurityHeadersConfig()));

  // Enable CORS with environment-aware configuration
  app.enableCors(environmentService.getCorsConfig());

  // Enable validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Body parser with environment-configured limits
  const maxSize = `${Math.floor(environmentService.getMaxFileSize() / 1024 / 1024)}mb`;
  app.use(bodyParser.json({ limit: maxSize }));
  app.use(bodyParser.urlencoded({ limit: maxSize, extended: true }));

  // Force HTTPS redirect in production
  if (environmentService.shouldForceHttps()) {
    app.use((req, res, next) => {
      if (req.header('x-forwarded-proto') !== 'https') {
        res.redirect(`https://${req.header('host')}${req.url}`);
      } else {
        next();
      }
    });
  }

  await app.listen(environmentService.getPort());
}
bootstrap();
