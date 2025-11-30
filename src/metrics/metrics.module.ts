import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';
import { MetricsMiddleware } from './metrics.middleware';
import { GrafanaPushService } from './grafana-push.service';
import { AlertService } from './alert.service';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'youtube_optimizer_',
        },
      },
      global: true, // Make metrics available globally
    }),
  ],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    MetricsMiddleware,
    GrafanaPushService,
    AlertService,
    // HTTP Request Counter
    makeCounterProvider({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    }),

    // HTTP Request Duration
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
    }),

    // Active Connections
    makeGaugeProvider({
      name: 'active_connections',
      help: 'Number of active connections',
    }),

    // Database Query Duration
    makeHistogramProvider({
      name: 'db_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['operation', 'table'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
    }),

    // AI Service Requests
    makeCounterProvider({
      name: 'ai_requests_total',
      help: 'Total number of AI service requests',
      labelNames: ['service', 'status'],
    }),

    // AI Request Duration
    makeHistogramProvider({
      name: 'ai_request_duration_seconds',
      help: 'AI request duration in seconds',
      labelNames: ['service'],
      buckets: [1, 5, 10, 30, 60],
    }),

    // Authentication Events
    makeCounterProvider({
      name: 'auth_events_total',
      help: 'Total number of authentication events',
      labelNames: ['event_type', 'status'],
    }),

    // Cache Hit/Miss
    makeCounterProvider({
      name: 'cache_operations_total',
      help: 'Total number of cache operations',
      labelNames: ['operation', 'result'],
    }),

    // Error Counter
    makeCounterProvider({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'severity'],
    }),

    // API Rate Limit
    makeCounterProvider({
      name: 'rate_limit_exceeded_total',
      help: 'Total number of rate limit exceeded events',
      labelNames: ['endpoint', 'ip'],
    }),
  ],
  exports: [PrometheusModule, MetricsService, MetricsMiddleware],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply metrics middleware to all routes
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
