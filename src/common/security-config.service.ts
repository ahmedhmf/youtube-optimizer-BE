import { Injectable } from '@nestjs/common';

export interface SecurityConfig {
  contentSecurityPolicy: any;
  hsts: any;
  crossOriginEmbedderPolicy: boolean;
  noSniff: boolean;
  xssFilter: boolean;
  referrerPolicy: any;
}

@Injectable()
export class SecurityConfigService {
  getSecurityConfig(): SecurityConfig {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isProduction = process.env.NODE_ENV === 'production';

    return {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: isDevelopment
            ? ["'self'", "'unsafe-eval'"] // Allow eval in development for hot reload
            : ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: [
            "'self'",
            'https://api.supabase.co',
            'wss://realtime.supabase.co',
            'https://*.googleapis.com', // For YouTube API
            'https://*.google.com', // For Google OAuth
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
}