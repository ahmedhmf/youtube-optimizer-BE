import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { IPRateLimitService } from './ip-rate-limit.service';

@Injectable()
export class IPRateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IPRateLimitMiddleware.name);

  constructor(private readonly rateLimitService: IPRateLimitService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const ipAddress = this.getClientIP(req);
    const endpoint = this.getEndpoint(req);
    const userAgent = req.get('user-agent');
    const userId = this.getUserId(req);

    try {
      const result = await this.rateLimitService.checkRateLimit(
        ipAddress,
        endpoint,
        userAgent,
        userId,
      );

      // Add rate limit headers to response
      res.set({
        'X-RateLimit-Limit': (
          result.remainingRequests + (result.allowed ? 1 : 0)
        ).toString(),
        'X-RateLimit-Remaining': result.remainingRequests.toString(),
        'X-RateLimit-Reset': Math.ceil(
          result.resetTime.getTime() / 1000,
        ).toString(),
      });

      if (!result.allowed) {
        // Add Retry-After header if request is blocked
        if (result.retryAfter) {
          res.set('Retry-After', result.retryAfter.toString());
        }

        this.logger.warn(
          `Rate limit exceeded for IP ${ipAddress} on endpoint ${endpoint}. ` +
            `Retry after ${result.retryAfter} seconds.`,
        );

        throw new HttpException(
          {
            message: 'Rate limit exceeded',
            error: 'Too Many Requests',
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            retryAfter: result.retryAfter,
            resetTime: result.resetTime.toISOString(),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Log successful rate limit check for high-risk endpoints
      if (this.isHighRiskEndpoint(endpoint)) {
        this.logger.debug(
          `Rate limit check passed for IP ${ipAddress} on ${endpoint}. ` +
            `Remaining: ${result.remainingRequests}`,
        );
      }

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      // Log error but don't block request if rate limiting fails
      this.logger.error('Rate limit check failed:', error);
      next();
    }
  }

  /**
   * Extract client IP address, handling proxies and load balancers
   */
  private getClientIP(req: Request): string {
    // Check various headers that might contain the real IP
    const possibleHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'x-client-ip',
      'cf-connecting-ip', // Cloudflare
      'x-forwarded',
      'forwarded-for',
      'forwarded',
    ];

    for (const header of possibleHeaders) {
      const value = req.get(header);
      if (value) {
        // x-forwarded-for can contain multiple IPs, take the first one
        const ip = value.split(',')[0].trim();
        if (this.isValidIP(ip)) {
          return ip;
        }
      }
    }

    // Fallback to connection remote address
    return (
      req.connection.remoteAddress || req.socket.remoteAddress || '0.0.0.0'
    );
  }

  /**
   * Extract endpoint path for rate limiting
   */
  private getEndpoint(req: Request): string {
    const path = req.path || req.url;

    // Remove leading slash and normalize
    let endpoint = path.replace(/^\//, '');

    // Handle API versioning (remove /api/v1/ prefix if present)
    endpoint = endpoint.replace(/^api\/v\d+\//, '');

    // Take only first two path segments for grouping
    const segments = endpoint.split('/').slice(0, 2);

    return segments.join('/') || 'root';
  }

  /**
   * Extract user ID from JWT token if available
   */
  private getUserId(req: Request): string | undefined {
    try {
      // Check if user is attached by auth guard
      const reqWithUser = req as Request & { user?: { id: string } };
      if (reqWithUser.user?.id) {
        return reqWithUser.user.id;
      }

      // Try to extract from Authorization header
      const authHeader = req.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // This is a simple extraction - in production you might want to verify the token
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64').toString(),
        ) as { sub?: string; user_id?: string; id?: string };
        return payload.sub || payload.user_id || payload.id;
      }
    } catch {
      // Ignore errors in user ID extraction
    }

    return undefined;
  }

  /**
   * Validate IP address format
   */
  private isValidIP(ip: string): boolean {
    // Basic IP validation (IPv4 and IPv6)
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i;

    if (ipv4Regex.test(ip)) {
      // Validate IPv4 octets
      return ip.split('.').every((octet) => {
        const num = parseInt(octet, 10);
        return num >= 0 && num <= 255;
      });
    }

    return ipv6Regex.test(ip);
  }

  /**
   * Check if endpoint is considered high-risk and needs more logging
   */
  private isHighRiskEndpoint(endpoint: string): boolean {
    const highRiskEndpoints = [
      'auth/login',
      'auth/register',
      'auth/reset-password',
      'analyze/video',
      'analyze/upload',
    ];

    return highRiskEndpoints.some((highRisk) => endpoint.includes(highRisk));
  }
}
