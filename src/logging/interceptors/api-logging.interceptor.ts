// src/logging/interceptors/api-logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ApiLogService } from '../services/api-log.service';
import { v4 as uuidv4 } from 'uuid';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
  requestId?: string;
  sessionId?: string;
}

@Injectable()
export class ApiLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApiLoggingInterceptor.name);

  constructor(private readonly apiLogService: ApiLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const requestId = (request.headers['x-request-id'] as string) || uuidv4();
    const startTime = Date.now();

    // Attach request ID to request object
    (request as AuthenticatedRequest).requestId = requestId;

    // Calculate request size
    const requestSize = request.headers['content-length']
      ? parseInt(request.headers['content-length'])
      : this.calculateSize(request.body);

    return next.handle().pipe(
      tap({
        next: (data) => {
          void this.logRequest(
            request,
            response,
            requestId,
            startTime,
            requestSize,
            data,
            null,
          );
        },
        error: (error) => {
          void this.logRequest(
            request,
            response,
            requestId,
            startTime,
            requestSize,
            null,
            error,
          );
        },
      }),
    );
  }

  private async logRequest(
    request: Request,
    response: Response,
    requestId: string,
    startTime: number,
    requestSize: number,
    responseData: any,
    error: any,
  ): Promise<void> {
    const responseTime = Date.now() - startTime;
    const statusCode: number = error
      ? (error as Error & { status?: number }).status || 500
      : response.statusCode;

    // Calculate response size safely (handles circular references)
    const responseSize = this.calculateSize(responseData);

    // Check if rate limit was hit
    const rateLimitHit = response.getHeader('X-RateLimit-Remaining') === '0';

    // Check if response was cached
    const cached = response.getHeader('X-Cache-Hit') === 'true';

    // Extract user info
    const user = (request as AuthenticatedRequest).user;

    // Should we log the request/response body?
    const shouldLogBodies = this.shouldLogBodies(request.path);

    await this.apiLogService.logRequest({
      requestId,
      userId: user?.id,
      endpoint: request.path,
      method: request.method,
      statusCode,
      responseTimeMs: responseTime,
      requestSizeBytes: requestSize,
      responseSizeBytes: responseSize,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      referrer: request.headers['referer'],
      queryParams: request.query,
      requestBody: shouldLogBodies
        ? (this.sanitizeBody(request.body) as Record<string, unknown>)
        : undefined,
      responseBody: shouldLogBodies
        ? (this.sanitizeBody(responseData) as Record<string, unknown>)
        : undefined,
      headers: this.sanitizeHeaders(request.headers) as Record<string, string>,
      errorMessage: error instanceof Error ? error.message : undefined,
      rateLimitHit,
      cached,
      sessionId: (request as AuthenticatedRequest).sessionId,
      deviceId: request.headers['x-device-id'] as string,
      geographicalLocation: this.extractGeoLocation() as
        | Record<string, unknown>
        | undefined,
    });
  }

  /**
   * Safely calculate size of an object (handles circular references)
   */
  private calculateSize(obj: any): number {
    if (!obj) return 0;

    try {
      // Create a set to track seen objects (detect circular references)
      const seen = new WeakSet();

      const stringifyWithCircularCheck = (value: any): string => {
        if (value !== null && typeof value === 'object') {
          if (seen.has(value as object)) {
            return '"[Circular]"';
          }
          seen.add(value as object);
        }
        return JSON.stringify(value, (_key, val) => {
          if (val !== null && typeof val === 'object') {
            if (seen.has(val as object)) {
              return '[Circular]';
            }
            seen.add(val as object);
          }
          return val as string | number | boolean | null | object;
        });
      };

      return stringifyWithCircularCheck(obj).length;
    } catch (error) {
      // If still fails, return approximate size
      this.logger.warn(
        'Failed to calculate object size:',
        error instanceof Error ? error.message : String(error),
      );
      return 0;
    }
  }

  /**
   * Determine if we should log request/response bodies
   */
  private shouldLogBodies(path: string): boolean {
    // Don't log bodies for sensitive endpoints
    const sensitiveEndpoints = [
      '/auth/login',
      '/auth/register',
      '/auth/reset-password',
    ];
    return !sensitiveEndpoints.some((endpoint) => path.includes(endpoint));
  }

  /**
   * Remove sensitive data from body (also handles circular references)
   */
  private sanitizeBody(body: any): any {
    if (!body) return null;

    try {
      const seen = new WeakSet();

      const sanitize = (obj: any): any => {
        if (obj === null || typeof obj !== 'object') {
          return obj;
        }

        // Check for circular reference
        if (seen.has(obj as object)) {
          return '[Circular]';
        }
        seen.add(obj as object);

        // Handle arrays
        if (Array.isArray(obj)) {
          return obj.map((item) => sanitize(item) as unknown);
        }

        // Handle objects
        const result: any = {};
        const sensitiveFields = [
          'password',
          'token',
          'secret',
          'apiKey',
          'creditCard',
          'ssn',
          'authorization',
        ];

        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            // Check if field is sensitive
            if (
              sensitiveFields.some((field) => key.toLowerCase().includes(field))
            ) {
              (result as Record<string, unknown>)[key] = '[REDACTED]';
            } else {
              // Skip Node.js internal objects that might cause issues
              if (
                key === 'socket' ||
                key === 'connection' ||
                key === 'parser' ||
                key === 'req' ||
                key === 'res'
              ) {
                (result as Record<string, unknown>)[key] = '[Skipped]';
                continue;
              }

              try {
                (result as Record<string, unknown>)[key] = sanitize(
                  (obj as Record<string, unknown>)[key],
                );
              } catch {
                (result as Record<string, unknown>)[key] = '[Error]';
              }
            }
          }
        }

        return result;
      };

      return sanitize(body);
    } catch (error) {
      this.logger.warn(
        'Failed to sanitize body:',
        error instanceof Error ? error.message : String(error),
      );
      return { error: 'Failed to sanitize body' };
    }
  }

  /**
   * Sanitize headers (remove sensitive data)
   */
  private sanitizeHeaders(headers: any): any {
    try {
      const sanitized: any = {};
      const sensitiveHeaders = [
        'authorization',
        'cookie',
        'x-api-key',
        'x-auth-token',
      ];

      for (const key in headers) {
        if (Object.prototype.hasOwnProperty.call(headers, key)) {
          if (
            sensitiveHeaders.some((header) =>
              key.toLowerCase().includes(header),
            )
          ) {
            (sanitized as Record<string, unknown>)[key] = '[REDACTED]';
          } else {
            (sanitized as Record<string, unknown>)[key] = (
              headers as Record<string, unknown>
            )[key];
          }
        }
      }

      return sanitized;
    } catch (error) {
      this.logger.warn(
        'Failed to sanitize headers:',
        error instanceof Error ? error.message : String(error),
      );
      return {};
    }
  }

  /**
   * Extract geographical location from IP (stub - integrate with geoip service)
   */
  private extractGeoLocation(): undefined {
    // TODO: Integrate with GeoIP service (MaxMind, IP2Location, etc.)
    // For now, return undefined or basic info
    return undefined;
  }
}
