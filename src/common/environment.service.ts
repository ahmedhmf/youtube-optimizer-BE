import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EnvironmentService {
  private readonly logger = new Logger(EnvironmentService.name);

  constructor(private readonly configService: ConfigService) {
    this.validateCriticalConfig();
  }

  private validateCriticalConfig(): void {
    const jwtSecret = this.getJwtSecret();
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }

    if (this.isProduction()) {
      const sessionSecret = this.getSessionSecret();
      if (sessionSecret.includes('your-super-secret-session-key')) {
        this.logger.error('SESSION_SECRET must be changed in production');
      }

      const corsOrigins = this.getCorsOrigins();
      if (corsOrigins.some((origin) => origin.includes('localhost'))) {
        this.logger.warn('CORS origins include localhost in production');
      }
    }

    this.logger.log('✅ Environment configuration validated');
  }

  isProduction(): boolean {
    return this.getNodeEnv() === 'production';
  }

  isDevelopment(): boolean {
    return this.getNodeEnv() === 'development';
  }

  getNodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  getPort(): number {
    return parseInt(this.configService.get<string>('PORT', '3000'), 10);
  }

  getJwtSecret(): string {
    return this.configService.get<string>('JWT_SECRET', '');
  }

  getSessionSecret(): string {
    return this.configService.get<string>('SESSION_SECRET', '');
  }

  getCorsOrigins(): string[] {
    const origins = this.configService.get<string>('CORS_ORIGINS', '');

    if (!origins) {
      return this.isProduction()
        ? ['https://your-production-domain.com']
        : ['http://localhost:4200', 'http://localhost:3000'];
    }

    return origins.split(',').map((origin) => origin.trim());
  }

  getCorsCredentials(): boolean {
    const value = this.configService.get<string>('CORS_CREDENTIALS', 'true');
    return value === 'true';
  }

  shouldForceHttps(): boolean {
    const value = this.configService.get<string>('FORCE_HTTPS', 'false');
    return value === 'true';
  }

  getMaxFileSize(): number {
    const size = this.configService.get<string>('MAX_FILE_SIZE', '10485760');
    return parseInt(size, 10);
  }

  getAllowedFileTypes(): string[] {
    const defaultTypes = 'image/jpeg,image/png,image/gif,video/mp4,video/webm';
    const types = this.configService.get<string>(
      'ALLOWED_FILE_TYPES',
      defaultTypes,
    );
    return types.split(',').map((type) => type.trim());
  }

  getCorsConfig() {
    const origins = this.getCorsOrigins();
    const isProduction = this.isProduction();

    return {
      origin: (
        requestOrigin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => {
        // Allow requests with no origin (mobile apps, etc.)
        if (!requestOrigin) {
          return callback(null, true);
        }

        // Check if origin is explicitly allowed
        if (origins.includes('*') || origins.includes(requestOrigin)) {
          return callback(null, true);
        }

        // In development, be more permissive with localhost
        if (!isProduction) {
          const isLocalhost =
            requestOrigin.includes('localhost') ||
            requestOrigin.includes('127.0.0.1');
          if (isLocalhost) {
            return callback(null, true);
          }
        }

        // Allow Vercel deployment
        if (requestOrigin === 'https://youtube-optimizer-fe.vercel.app') {
          return callback(null, true);
        }

        // Block the request
        this.logger.warn(`CORS blocked origin: ${requestOrigin}`);
        const error = new Error(`Origin not allowed: ${requestOrigin}`);
        return callback(error, false);
      },
      credentials: this.getCorsCredentials(),
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'X-API-Key',
        'X-CSRF-Token',
      ],
      exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
      maxAge: isProduction ? 86400 : 300,
      preflightContinue: false,
      optionsSuccessStatus: 204,
    };
  }

  getSecurityHeadersConfig() {
    const isProduction = this.isProduction();
    const isDevelopment = this.isDevelopment();

    const connectSrcList = [
      "'self'",
      'https://api.supabase.co',
      'wss://realtime.supabase.co',
      'https://*.googleapis.com',
      'https://*.google.com',
    ];

    // Add development-specific sources
    if (isDevelopment) {
      connectSrcList.push('ws://localhost:*', 'http://localhost:*');
    }

    return {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: isDevelopment
            ? ["'self'", "'unsafe-eval'", "'unsafe-inline'"]
            : ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          connectSrc: connectSrcList,
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'", 'https:', 'blob:'],
          frameSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: isProduction ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: isProduction
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
      noSniff: true,
      xssFilter: true,
      referrerPolicy: false, // Disabled for compatibility, CSP handles this
      poweredBy: false,
    };
  }

  getRateLimitConfig() {
    const isProduction = this.isProduction();

    return [
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: isProduction ? 2 : 5,
      },
      {
        name: 'medium',
        ttl: 10000, // 10 seconds
        limit: isProduction ? 15 : 25,
      },
      {
        name: 'long',
        ttl: 60000, // 1 minute
        limit: isProduction ? 50 : 100,
      },
    ];
  }
}
