import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SecurityConfig {
  contentSecurityPolicy: any;
  hsts: any;
  crossOriginEmbedderPolicy: boolean;
  noSniff: boolean;
  xssFilter: boolean;
  referrerPolicy: any;
}

export interface SecurityValidationRules {
  password: {
    minLength: number;
    maxLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
  email: {
    maxLength: number;
  };
  text: {
    maxLength: number;
    allowedCharacters: RegExp;
  };
  files: {
    maxSize: number;
    allowedMimeTypes: string[];
  };
}

@Injectable()
export class SecurityConfigService {
  constructor(private configService: ConfigService) {}
  getSecurityConfig(): SecurityConfig {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isProduction = process.env.NODE_ENV === 'production';

    return {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: isDevelopment ? ["'self'", "'unsafe-eval'"] : ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: [
            "'self'",
            'https://api.supabase.co',
            'wss://realtime.supabase.co',
            'https://*.googleapis.com',
            'https://*.google.com',
          ],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'", 'https:'], // Allow media from HTTPS sources
          frameSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: isProduction ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false, // Allow embedding for API usage
      hsts: isProduction
        ? {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
          }
        : false, // Disable HSTS in development
      noSniff: true,
      xssFilter: true,
      referrerPolicy: {
        policy: isProduction
          ? 'strict-origin-when-cross-origin'
          : 'no-referrer-when-downgrade',
      },
    };
  }

  getCorsConfig() {
    const isDevelopment = process.env.NODE_ENV === 'development';

    return {
      origin: isDevelopment
        ? ['http://localhost:4200', 'http://localhost:3000']
        : process.env.FRONTEND_URL || 'https://your-production-domain.com',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
      optionsSuccessStatus: 200, // Some legacy browsers choke on 204
      maxAge: 86400, // Cache preflight response for 24 hours
    };
  }

  getValidationRules(): SecurityValidationRules {
    return {
      password: {
        minLength: 8,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
      },
      email: {
        maxLength: 255,
      },
      text: {
        maxLength: 1000,
        allowedCharacters: /^[a-zA-Z0-9\s\-',.!?()]+$/,
      },
      files: {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: [
          'text/plain',
          'application/json',
          'text/vtt',
          'application/x-subrip',
        ],
      },
    };
  }

  getPasswordRegex(): RegExp {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
  }

  getNameRegex(): RegExp {
    return /^[a-zA-Z\s\-']+$/;
  }

  getYouTubeUrlRegex(): RegExp {
    return /^https:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/;
  }

  getRateLimitConfig() {
    return {
      global: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: Number(this.configService.get('RATE_LIMIT_MAX', 1000)),
      },
      auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: Number(this.configService.get('AUTH_RATE_LIMIT_MAX', 10)),
      },
    };
  }

  getSuspiciousPatterns(): RegExp[] {
    return [
      // SQL Injection patterns
      /(%27)|(')|(--)|(%23)|(#)/gi,
      /union\s+select/gi,
      /drop\s+table/gi,
      /delete\s+from/gi,
      /insert\s+into/gi,

      // XSS patterns
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi,

      // Path traversal
      /\.\.\//gi,
      /\\\.\.\\/gi,
      /\/etc\/passwd/gi,
    ];
  }

  isPatternSuspicious(input: string): boolean {
    const patterns = this.getSuspiciousPatterns();
    return patterns.some((pattern) => pattern.test(input));
  }

  validateEnvironmentVariables(): { isValid: boolean; errors: string[] } {
    const required = [
      'JWT_SECRET',
      'DATABASE_URL',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_KEY',
      'SESSION_SECRET',
    ];

    const errors: string[] = [];

    for (const variable of required) {
      const value = this.configService.get<string>(variable);
      if (!value) {
        errors.push(`Missing required environment variable: ${variable}`);
      } else if (variable === 'JWT_SECRET' && value.length < 32) {
        errors.push('JWT_SECRET should be at least 32 characters long');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
