/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Controller, Get, Query } from '@nestjs/common';
import { register } from 'prom-client';
import { AlertService } from './alert.service';

@Controller('api/v1')
export class MetricsController {
  constructor(private readonly alertService: AlertService) {}
  /**
   * Get metrics in JSON format for frontend dashboard
   * Access at: GET /api/v1/metrics-dashboard
   */
  @Get('metrics-dashboard')
  async getDashboardMetrics() {
    const metrics: any = await register.getMetricsAsJSON();

    // Extract key metrics for dashboard
    const httpRequests = metrics.find(
      (m) => m.name === 'youtube_optimizer_http_requests_total',
    );
    const errors = metrics.find(
      (m) => m.name === 'youtube_optimizer_errors_total',
    );
    const aiRequests = metrics.find(
      (m) => m.name === 'youtube_optimizer_ai_requests_total',
    );
    const dbQueries = metrics.find(
      (m) => m.name === 'youtube_optimizer_db_query_duration_seconds',
    );
    const cacheOps = metrics.find(
      (m) => m.name === 'youtube_optimizer_cache_operations_total',
    );
    const authEvents = metrics.find(
      (m) => m.name === 'youtube_optimizer_auth_events_total',
    );

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalHttpRequests: this.sumMetricValues(httpRequests),
        totalErrors: this.sumMetricValues(errors),
        totalAiRequests: this.sumMetricValues(aiRequests),
        totalCacheOperations: this.sumMetricValues(cacheOps),
        totalAuthEvents: this.sumMetricValues(authEvents),
        avgDbQueryTime: this.calculateAverage(dbQueries),
      },
      details: {
        httpRequests: httpRequests?.values || [],
        errors: errors?.values || [],
        aiRequests: aiRequests?.values || [],
        cacheOperations: cacheOps?.values || [],
        authEvents: authEvents?.values || [],
      },
    };
  }

  /**
   * Get all metrics in JSON format
   * Access at: GET /api/v1/metrics-json
   */
  @Get('metrics-json')
  async getMetricsJson() {
    const metrics: any = await register.getMetricsAsJSON();

    return {
      timestamp: new Date().toISOString(),
      metrics: metrics.map((metric: any) => ({
        name: metric.name,
        help: metric.help,
        type: metric.type,
        values: metric.values || [],
      })),
    };
  }

  private sumMetricValues(metric: any): number {
    if (!metric?.values) return 0;
    return metric.values.reduce(
      (sum: number, v: any) => sum + (v.value || 0),
      0,
    );
  }

  private calculateAverage(metric: any): number {
    if (!metric?.values || metric.values.length === 0) return 0;
    const sum = this.sumMetricValues(metric);
    return sum / metric.values.length;
  }

  /**
   * Test alert system
   * Access at: GET /api/v1/test-alert?channel=telegram
   */
  @Get('test-alert')
  async testAlert(@Query('channel') channel: string) {
    const validChannels = ['telegram', 'email', 'whatsapp'];
    const alertChannel = validChannels.includes(channel)
      ? (channel as 'telegram' | 'email' | 'whatsapp')
      : 'telegram';

    const result = await this.alertService.testAlert(alertChannel);
    return result;
  }
}
