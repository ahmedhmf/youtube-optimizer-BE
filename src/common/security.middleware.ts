import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    // Log security-relevant requests
    this.logSecurityEvents(req);

    // Add security response headers
    this.addSecurityHeaders(res);

    // Detect suspicious patterns
    this.detectSuspiciousActivity(req);

    next();
  }

  private logSecurityEvents(req: Request) {
    const securityEvents = [
      '/auth/login',
      '/auth/register',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/admin',
    ];

    const isSecurityEvent = securityEvents.some((event) =>
      req.path.includes(event),
    );

    if (isSecurityEvent) {
      this.logger.log(
        `Security Event: ${req.method} ${req.path} from ${req.ip}`,
        {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method,
          timestamp: new Date().toISOString(),
        },
      );
    }
  }

  private addSecurityHeaders(res: Response) {
    // Additional custom security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
    );
  }

  private detectSuspiciousActivity(req: Request) {
    // Detect potential SQL injection attempts
    const sqlInjectionPatterns = [
      /(\bUNION\b.*\bSELECT\b)/i,
      /(\bDROP\b.*\bTABLE\b)/i,
      /(\bINSERT\b.*\bINTO\b)/i,
      /(--|#|\/\*)/,
      /(\bOR\b.*\b=\b.*\bOR\b)/i,
    ];

    // Detect XSS attempts
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/i,
      /on\w+\s*=/i,
    ];

    const requestContent =
      JSON.stringify(req.body) + req.url + JSON.stringify(req.query);

    [...sqlInjectionPatterns, ...xssPatterns].forEach((pattern) => {
      if (pattern.test(requestContent)) {
        this.logger.warn(`Suspicious activity detected from IP: ${req.ip}`, {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          pattern: pattern.toString(),
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Detect unusual request patterns
    if (req.path.length > 1000) {
      this.logger.warn(`Unusually long request path from IP: ${req.ip}`, {
        ip: req.ip,
        pathLength: req.path.length,
        timestamp: new Date().toISOString(),
      });
    }
  }
}