import { Injectable, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import express from 'express';

export interface CSRFConfig {
  tokenLength: number;
  cookieName: string;
  headerName: string;
  bodyField: string;
  sessionKey: string;
}

@Injectable()
export class CSRFService {
  private readonly config: CSRFConfig = {
    tokenLength: 32,
    cookieName: '_csrf',
    headerName: 'x-csrf-token',
    bodyField: '_csrf',
    sessionKey: 'csrfSecret',
  };

  /**
   * Generate a CSRF token for the session
   */
  generateToken(req: express.Request): string {
    // Generate or retrieve secret from session
    let secret = req.session?.[this.config.sessionKey] as string | undefined;
    if (!secret) {
      secret = crypto.randomBytes(this.config.tokenLength).toString('base64');
      req.session[this.config.sessionKey] = secret;
    }

    // Generate token based on secret
    const token = this.generateTokenFromSecret(secret);
    return token;
  }

  /**
   * Validate CSRF token from request
   */
  validateToken(req: Request): boolean {
    const secret = req.session[this.config.sessionKey] as string | undefined;
    if (!secret) {
      return false;
    }

    // Get token from header, body, or query
    const token = this.extractToken(req);
    if (!token) {
      return false;
    }

    // Validate token
    const expectedToken = this.generateTokenFromSecret(secret);
    return this.secureCompare(token, expectedToken);
  }

  /**
   * Set CSRF token as cookie (for AJAX requests)
   */
  setCsrfCookie(req: Request, res: Response): void {
    const token = this.generateToken(req);

    res.cookie(this.config.cookieName, token, {
      httpOnly: false, // Allow JavaScript access for AJAX
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });
  }

  /**
   * Check if request should be protected by CSRF
   */
  shouldProtect(req: Request): boolean {
    const method = req.method?.toLowerCase();
    const safeMethods = ['get', 'head', 'options'];

    // Skip safe methods
    if (safeMethods.includes(method)) {
      return false;
    }

    // Skip API routes with JWT token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return false;
    }

    // Skip specific routes (only token endpoint, OAuth routes, and health check)
    const skipRoutes = [
      '/auth/csrf-token',
      '/auth/csrf-verify',
      '/auth/social/google',
      '/auth/social/github',
      '/auth/logout',
      '/auth/logout-all',
      '/health',
    ];

    return !skipRoutes.some((route) => req.path.startsWith(route));
  }

  private generateTokenFromSecret(secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    // Use a stable value instead of Date.now() for token validation
    hmac.update('csrf-token-validation');
    return hmac.digest('base64');
  }

  private extractToken(req: Request): string | null {
    // Try header first
    let token = req.headers[this.config.headerName] as string;

    // Try body field
    if (!token && req.body && typeof req.body === 'object') {
      token = (req.body as Record<string, any>)[
        this.config.bodyField
      ] as string;
    }

    // Try query parameter
    if (!token && req.query) {
      token = req.query[this.config.bodyField] as string;
    }

    return token || null;
  }

  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Middleware function for CSRF protection
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Check if this request needs CSRF protection
      if (this.shouldProtect(req)) {
        if (!this.validateToken(req)) {
          throw new BadRequestException('Invalid CSRF token');
        }
      }
      next();
    };
  }
}
