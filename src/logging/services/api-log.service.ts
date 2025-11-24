// src/logging/services/api-log.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from 'src/supabase/supabase.service';
import { ApiLogData } from '../dto/log.types';

@Injectable()
export class ApiLogService {
  private readonly logger = new Logger(ApiLogService.name);
  private logQueue: ApiLogData[] = [];
  private batchSize = 10;
  private batchInterval = 5000; // 5 seconds

  constructor(private readonly supabase: SupabaseService) {
    // Start batch processing
    this.startBatchProcessing();
  }

  /**
   * Log API request (adds to queue for batch insert)
   */
  async logRequest(data: ApiLogData): Promise<void> {
    try {
      // Add to queue for batch processing
      this.logQueue.push(data);

      // If queue is full, process immediately
      if (this.logQueue.length >= this.batchSize) {
        await this.processBatch();
      }
    } catch (error) {
      this.logger.error('Error queuing API log:', error);
    }
  }

  /**
   * Process batch of logs
   */
  private async processBatch(): Promise<void> {
    if (this.logQueue.length === 0) return;

    const client = this.supabase.getServiceClient();
    const batch = [...this.logQueue];
    this.logQueue = [];

    try {
      const { error } = await client.from('api_request_logs').insert(
        batch.map((log) => ({
          request_id: log.requestId,
          user_id: log.userId || null,
          endpoint: log.endpoint,
          method: log.method,
          status_code: log.statusCode,
          response_time_ms: log.responseTimeMs,
          request_size_bytes: log.requestSizeBytes || null,
          response_size_bytes: log.responseSizeBytes || null,
          ip_address: log.ipAddress || null,
          user_agent: log.userAgent || null,
          referrer: log.referrer || null,
          query_params: log.queryParams || {},
          request_body: log.requestBody || null,
          response_body: log.responseBody || null,
          headers: log.headers || {},
          error_message: log.errorMessage || null,
          rate_limit_hit: log.rateLimitHit || false,
          cached: log.cached || false,
          session_id: log.sessionId || null,
          device_id: log.deviceId || null,
          geographical_location: log.geographicalLocation || null,
          created_at: new Date().toISOString(),
        })),
      );

      if (error) {
        this.logger.error('Failed to insert API logs batch:', error);
        // Re-add to queue for retry
        this.logQueue.unshift(...batch);
      } else {
        this.logger.debug(`Successfully logged ${batch.length} API requests`);
      }
    } catch (error) {
      this.logger.error('Exception processing API logs batch:', error);
      this.logQueue.unshift(...batch);
    }
  }

  /**
   * Start batch processing interval
   */
  private startBatchProcessing(): void {
    setInterval(() => {
      this.processBatch();
    }, this.batchInterval);
  }

  /**
   * Get API logs with filters
   */
  async getLogs(filters?: {
    userId?: string;
    endpoint?: string;
    method?: string;
    statusCode?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const client = this.supabase.getServiceClient();

    try {
      let query = client
        .from('api_request_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters?.endpoint) {
        query = query.ilike('endpoint', `%${filters.endpoint}%`);
      }

      if (filters?.method) {
        query = query.eq('method', filters.method);
      }

      if (filters?.statusCode) {
        query = query.eq('status_code', filters.statusCode);
      }

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.range(
          filters.offset,
          filters.offset + (filters.limit || 10) - 1,
        );
      }

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      return {
        data: data || [],
        total: count || 0,
      };
    } catch (error) {
      this.logger.error('Error fetching API logs:', error);
      throw error;
    }
  }

  /**
   * Get API performance statistics
   */
  async getPerformanceStats(hours: number = 24) {
    const client = this.supabase.getServiceClient();

    try {
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - hours);

      const { data, error } = await client
        .from('api_request_logs')
        .select('endpoint, method, response_time_ms, status_code')
        .gte('created_at', startDate.toISOString());

      if (error) {
        throw error;
      }

      // Group by endpoint
      const endpointStats: Record<string, any> = {};

      (data || []).forEach((log) => {
        const key = `${log.method} ${log.endpoint}`;
        if (!endpointStats[key]) {
          endpointStats[key] = {
            endpoint: log.endpoint,
            method: log.method,
            requestCount: 0,
            totalResponseTime: 0,
            errors: 0,
            responseTimes: [],
          };
        }

        endpointStats[key].requestCount++;
        endpointStats[key].totalResponseTime += log.response_time_ms;
        endpointStats[key].responseTimes.push(log.response_time_ms);

        if (log.status_code >= 400) {
          endpointStats[key].errors++;
        }
      });

      // Calculate statistics
      return Object.values(endpointStats).map((stats: any) => ({
        endpoint: stats.endpoint,
        method: stats.method,
        requestCount: stats.requestCount,
        avgResponseTime: stats.totalResponseTime / stats.requestCount,
        p95ResponseTime: this.calculatePercentile(stats.responseTimes, 0.95),
        p99ResponseTime: this.calculatePercentile(stats.responseTimes, 0.99),
        errorRate: (stats.errors / stats.requestCount) * 100,
      }));
    } catch (error) {
      this.logger.error('Error fetching API performance stats:', error);
      throw error;
    }
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[index] || 0;
  }

  /**
   * Flush remaining logs on shutdown
   */
  async onModuleDestroy() {
    await this.processBatch();
  }
}
