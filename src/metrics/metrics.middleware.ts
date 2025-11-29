import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(
    @InjectMetric('http_requests_total')
    private readonly requestCounter: Counter<string>,
    @InjectMetric('http_request_duration_seconds')
    private readonly requestDuration: Histogram<string>,
    @InjectMetric('active_connections')
    private readonly activeConnections: Gauge<string>,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Increment active connections
    this.activeConnections.inc();

    const start = Date.now();

    // Capture response finish event
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const route = this.getRoute(req);
      const labels = {
        method: req.method,
        route,
        status_code: res.statusCode.toString(),
      };

      // Increment request counter
      this.requestCounter.inc(labels);

      // Record request duration
      this.requestDuration.observe(labels, duration);

      // Decrement active connections
      this.activeConnections.dec();
    });

    next();
  }

  private getRoute(req: Request): string {
    // Extract route pattern from request
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const route = (req.route?.path as string | undefined) || req.path;

    // Normalize route by removing IDs and dynamic segments
    return String(route)
      .replace(/\/[0-9a-f-]{36}/g, '/:id') // UUIDs
      .replace(/\/\d+/g, '/:id') // Numeric IDs
      .replace(/\/[a-zA-Z0-9_-]{20,}/g, '/:token'); // Tokens
  }
}
