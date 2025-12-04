import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { StructuredLoggerService } from './structured-logger.service';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: StructuredLoggerService) {}

  use(
    req: Request & { correlationId?: string; user?: { id?: string } },
    res: Response,
    next: NextFunction,
  ) {
    const correlationId = req.correlationId;
    const startTime = Date.now();

    // Log incoming request
    this.logger.logRequest(
      correlationId ?? '',
      req.method,
      req.url,
      req.user?.id,
      {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      },
    );

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      this.logger.logResponse(
        correlationId ?? '',
        req.method,
        req.url,
        res.statusCode,
        duration,
        req.user?.id,
      );
    });

    next();
  }
}
