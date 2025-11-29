import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('errors_total')
    private readonly errorCounter: Counter<string>,
    @InjectMetric('db_query_duration_seconds')
    private readonly dbQueryDuration: Histogram<string>,
    @InjectMetric('ai_requests_total')
    private readonly aiRequestCounter: Counter<string>,
    @InjectMetric('ai_request_duration_seconds')
    private readonly aiRequestDuration: Histogram<string>,
    @InjectMetric('auth_events_total')
    private readonly authEventCounter: Counter<string>,
    @InjectMetric('cache_operations_total')
    private readonly cacheOperationCounter: Counter<string>,
    @InjectMetric('rate_limit_exceeded_total')
    private readonly rateLimitCounter: Counter<string>,
  ) {}

  /**
   * Record an error event
   */
  recordError(
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
  ): void {
    this.errorCounter.inc({ type, severity });
  }

  /**
   * Record database query duration
   */
  recordDbQuery(
    operation: string,
    table: string,
    durationSeconds: number,
  ): void {
    this.dbQueryDuration.observe({ operation, table }, durationSeconds);
  }

  /**
   * Record AI service request
   */
  recordAiRequest(service: string, status: 'success' | 'error'): void {
    this.aiRequestCounter.inc({ service, status });
  }

  /**
   * Record AI request duration
   */
  recordAiRequestDuration(service: string, durationSeconds: number): void {
    this.aiRequestDuration.observe({ service }, durationSeconds);
  }

  /**
   * Record authentication event
   */
  recordAuthEvent(eventType: string, status: 'success' | 'failure'): void {
    this.authEventCounter.inc({ event_type: eventType, status });
  }

  /**
   * Record cache operation
   */
  recordCacheOperation(
    operation: 'get' | 'set' | 'delete',
    result: 'hit' | 'miss' | 'success' | 'error',
  ): void {
    this.cacheOperationCounter.inc({ operation, result });
  }

  /**
   * Record rate limit exceeded
   */
  recordRateLimitExceeded(endpoint: string, ip: string): void {
    this.rateLimitCounter.inc({ endpoint, ip });
  }

  /**
   * Time a database query and record it
   */
  async timeDbQuery<T>(
    operation: string,
    table: string,
    queryFn: () => Promise<T>,
  ): Promise<T> {
    const start = Date.now();
    try {
      return await queryFn();
    } finally {
      const duration = (Date.now() - start) / 1000;
      this.recordDbQuery(operation, table, duration);
    }
  }

  /**
   * Time an AI request and record it
   */
  async timeAiRequest<T>(
    service: string,
    requestFn: () => Promise<T>,
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await requestFn();
      this.recordAiRequest(service, 'success');
      return result;
    } catch (error) {
      this.recordAiRequest(service, 'error');
      throw error;
    } finally {
      const duration = (Date.now() - start) / 1000;
      this.recordAiRequestDuration(service, duration);
    }
  }
}
