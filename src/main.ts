import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import * as bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import helmet from 'helmet';
import { EnvironmentService } from './common/environment.service';
import { CSRFService } from './common/csrf.service';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get environment service from the application context
  const environmentService = app.get(EnvironmentService);

  // Cookie parser for session management
  app.use(cookieParser());

  // Session configuration with security settings
  const isProduction = environmentService.isProduction();
  app.use(
    session({
      secret: environmentService.getSessionSecret(),
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProduction, // HTTPS only in production
        httpOnly: true, // Prevent XSS
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: isProduction ? 'strict' : 'lax', // CSRF protection
      },
      name: 'sessionId', // Don't use default 'connect.sid'
    }),
  );

  // Enable CORS with environment-aware configuration (BEFORE other middleware)
  app.enableCors(environmentService.getCorsConfig());

  // Security headers with Helmet
  app.use(helmet(environmentService.getSecurityHeadersConfig()));

  // CSRF Protection Service (AFTER CORS)
  const csrfService = app.get(CSRFService);
  app.use(csrfService.middleware());

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

  const config = new DocumentBuilder()
    .setTitle('Descripta APIs')
    .setDescription('The Descripta API description')
    .setVersion('1.0')
    .addTag('descripta')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(environmentService.getPort());
}
bootstrap();
