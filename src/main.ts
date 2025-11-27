import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import * as bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { EnvironmentService } from './common/environment.service';
import { EnvValidationService } from './common/env-validation.service';
import { CSRFService } from './common/csrf.service';
import { ValidationAndSanitizationPipe } from './common/validation-sanitization.pipe';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validate environment variables on startup
  const envValidationService = app.get(EnvValidationService);
  envValidationService.validateEnvironment();

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

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      message: {
        error: 'Too many requests from this IP',
        retryAfter: '15 minutes',
      },
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Specific rate limiting for auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 auth requests per windowMs
    message: {
      error: 'Too many authentication attempts',
      retryAfter: '15 minutes',
    },
    skip: (req) => {
      const authPaths = [
        '/auth/login',
        '/auth/register',
        '/auth/forgot-password',
      ];
      return !authPaths.some((path) => req.path.startsWith(path));
    },
  });

  app.use('/auth', authLimiter);

  // CSRF Protection Service (AFTER CORS and rate limiting)
  const csrfService = app.get(CSRFService);
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF for public authentication endpoints and health check
    const skipCSRFPaths = [
      '/auth/register',
      '/auth/login',
      '/auth/refresh',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/csrf-token',
      '/auth/social/google',
      '/auth/social/google/url',
      '/auth/social/google/callback',
      '/health',
    ];
    if (skipCSRFPaths.some((path) => req.path === path)) {
      return next();
    }

    // Apply CSRF middleware for authenticated routes
    return csrfService.middleware()(req, res, next);
  });

  // Enhanced validation pipes with sanitization
  app.useGlobalPipes(
    new ValidationAndSanitizationPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: isProduction, // Don't expose validation details in production
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  // Body parser with environment-configured limits
  const maxSize = `${Math.floor(environmentService.getMaxFileSize() / 1024 / 1024)}mb`;
  app.use(bodyParser.json({ limit: maxSize }));
  app.use(bodyParser.urlencoded({ limit: maxSize, extended: true }));
  // Force HTTPS redirect in production
  if (environmentService.shouldForceHttps()) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.header('x-forwarded-proto') !== 'https') {
        res.redirect(`https://${req.header('host')}${req.url}`);
      } else {
        next();
      }
    });
  }

  // Set global API version prefix (e.g., /api/v1/auth/login)
  app.setGlobalPrefix('api/v1', {
    exclude: [
      'health', // Keep health check at root level for monitoring
      'health/liveness', // Kubernetes liveness probe
      'health/readiness', // Kubernetes readiness probe
      'api', // Swagger docs at /api
      'auth/social/google', // Google OAuth callback (must match GOOGLE_REDIRECT_URI)
      'auth/social/github', // GitHub OAuth callback (if used)
    ],
  });

  // Swagger/OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('YouTube Optimizer API')
    .setDescription(
      'YouTube video optimization API with AI-powered suggestions',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token',
        in: 'header',
      },
      'access-token',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-CSRF-Token',
        in: 'header',
        description: 'CSRF protection token (get from /auth/csrf-token)',
      },
      'csrf-token',
    )
    .addTag('auth', 'Authentication & Authorization')
    .addTag('youtube', 'YouTube Video Analysis')
    .addTag('ai', 'AI Suggestions & Optimization')
    .addTag('admin', 'Admin Management')
    .addTag('logs', 'Logging & Monitoring')
    .addTag('onboarding', 'User Onboarding')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documentFactory, {
    customSiteTitle: 'YouTube Optimizer API Docs',
    customfavIcon: 'https://nestjs.com/img/logo_text.svg',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  await app.listen(environmentService.getPort());
}
void bootstrap();
