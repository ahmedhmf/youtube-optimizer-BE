// src/logging/services/system-log.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as os from 'os';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  SystemLogData,
  LogSeverity,
  SystemLogCategory,
} from '../dto/log.types';

@Injectable()
export class SystemLogService {
  private readonly logger = new Logger(SystemLogService.name);
  private readonly hostname = os.hostname();
  private readonly processId = process.pid;

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Log system event
   * NOTE: Only logs CRITICAL system events to Supabase
   * Routine system logs are handled via Winston file logging
   */
  async logSystem(data: SystemLogData): Promise<void> {
    // Only log critical and error level system events to Supabase
    const isCritical =
      data.logLevel === LogSeverity.CRITICAL ||
      data.logLevel === LogSeverity.ERROR ||
      data.category === SystemLogCategory.DATABASE ||
      data.category === SystemLogCategory.CRON;

    if (!isCritical) {
      // Skip Supabase logging for routine system events - Winston handles this
      // Still log to console for visibility
      if (data.logLevel === LogSeverity.WARNING) {
        this.logger.warn(`[${data.category}] ${data.message}`);
      }
      return;
    }

    const client = this.supabase.getServiceClient();

    try {
      const { error } = await client.from('system_logs').insert({
        log_level: data.logLevel,
        category: data.category,
        service_name: data.serviceName,
        message: data.message,
        details: data.details || {},
        stack_trace: data.stackTrace || null,
        hostname: data.hostname || this.hostname,
        process_id: data.processId || this.processId,
        memory_usage_mb: data.memoryUsageMb || this.getMemoryUsage(),
        cpu_usage_percent: data.cpuUsagePercent || null,
        related_entity_type: data.relatedEntityType || null,
        related_entity_id: data.relatedEntityId || null,
        request_id: data.requestId || null,
        resolved: false,
        created_at: new Date().toISOString(),
      });

      if (error) {
        this.logger.error('Failed to log critical system event:', error);
      }

      // Also log to console for critical errors
      this.logger.error(`[${data.category}] ${data.message}`, data.stackTrace);
    } catch (error) {
      this.logger.error('Exception logging critical system event:', error);
    }
  }

  /**
   * Log database operation
   */
  async logDatabaseOperation(
    operation: string,
    table: string,
    success: boolean,
    duration?: number,
    error?: any,
  ): Promise<void> {
    await this.logSystem({
      logLevel: success ? LogSeverity.INFO : LogSeverity.ERROR,
      category: SystemLogCategory.DATABASE,
      serviceName: 'DatabaseService',
      message: `Database ${operation} on ${table} ${success ? 'succeeded' : 'failed'}`,
      details: {
        operation,
        table,
        duration,
        error: error instanceof Error ? error.message : undefined,
      },
      stackTrace: error instanceof Error ? error.stack : undefined,
    });
  }

  /**
   * Log cache operation
   */
  async logCacheOperation(
    operation: string,
    key: string,
    success: boolean,
    error?: any,
  ): Promise<void> {
    await this.logSystem({
      logLevel: success ? LogSeverity.DEBUG : LogSeverity.WARNING,
      category: SystemLogCategory.CACHE,
      serviceName: 'CacheService',
      message: `Cache ${operation} for key ${key} ${success ? 'succeeded' : 'failed'}`,
      details: {
        operation,
        key,
        error: error instanceof Error ? error.message : undefined,
      },
      stackTrace: error instanceof Error ? error.stack : undefined,
    });
  }

  /**
   * Log email operation
   */
  async logEmailOperation(
    operation: string,
    recipient: string,
    success: boolean,
    error?: any,
  ): Promise<void> {
    await this.logSystem({
      logLevel: success ? LogSeverity.INFO : LogSeverity.ERROR,
      category: SystemLogCategory.EMAIL,
      serviceName: 'EmailService',
      message: `Email ${operation} to ${recipient} ${success ? 'succeeded' : 'failed'}`,
      details: {
        operation,
        recipient,
        error: error instanceof Error ? error.message : undefined,
      },
      stackTrace: error instanceof Error ? error.stack : undefined,
    });
  }

  /**
   * Log cron job execution
   */
  async logCronJob(
    jobName: string,
    success: boolean,
    duration?: number,
    error?: any,
  ): Promise<void> {
    await this.logSystem({
      logLevel: success ? LogSeverity.INFO : LogSeverity.ERROR,
      category: SystemLogCategory.CRON,
      serviceName: 'CronService',
      message: `Cron job ${jobName} ${success ? 'completed' : 'failed'}`,
      details: {
        jobName,
        duration,
        error: error instanceof Error ? error.message : undefined,
      },
      stackTrace: error instanceof Error ? error.stack : undefined,
    });
  }

  /**
   * Log queue operation
   */
  async logQueueOperation(
    queueName: string,
    operation: string,
    success: boolean,
    jobCount?: number,
    error?: any,
  ): Promise<void> {
    await this.logSystem({
      logLevel: success ? LogSeverity.INFO : LogSeverity.WARNING,
      category: SystemLogCategory.QUEUE,
      serviceName: 'QueueService',
      message: `Queue ${operation} on ${queueName} ${success ? 'succeeded' : 'failed'}`,
      details: {
        queueName,
        operation,
        jobCount,
        error: error instanceof Error ? error.message : undefined,
      },
    });
  }

  /**
   * Get system logs with filters
   */
  async getLogs(filters?: {
    logLevel?: LogSeverity;
    category?: SystemLogCategory;
    serviceName?: string;
    resolved?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const client = this.supabase.getServiceClient();

    try {
      let query = client
        .from('system_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filters?.logLevel) {
        query = query.eq('log_level', filters.logLevel);
      }

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      if (filters?.serviceName) {
        query = query.eq('service_name', filters.serviceName);
      }

      if (filters?.resolved !== undefined) {
        query = query.eq('resolved', filters.resolved);
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
      this.logger.error('Error fetching system logs:', error);
      throw error;
    }
  }

  /**
   * Get system health metrics
   */
  async getHealthMetrics() {
    const client = this.supabase.getServiceClient();

    try {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const { data, error } = await client
        .from('system_logs')
        .select('log_level, category, memory_usage_mb')
        .gte('created_at', oneHourAgo.toISOString());

      if (error) {
        throw error;
      }

      const metrics = {
        errorCount: 0,
        warningCount: 0,
        criticalCount: 0,
        avgMemoryUsage: 0,
        byCategory: {} as Record<string, number>,
      };

      let totalMemory = 0;
      let memoryCount = 0;

      (data || []).forEach(
        (log: {
          log_level: LogSeverity;
          category: string;
          memory_usage_mb: number | null;
        }) => {
          if (log.log_level === LogSeverity.ERROR) metrics.errorCount++;
          if (log.log_level === LogSeverity.WARNING) metrics.warningCount++;
          if (log.log_level === LogSeverity.CRITICAL) metrics.criticalCount++;

          metrics.byCategory[log.category] =
            (metrics.byCategory[log.category] || 0) + 1;

          if (log.memory_usage_mb) {
            totalMemory += log.memory_usage_mb;
            memoryCount++;
          }
        },
      );

      if (memoryCount > 0) {
        metrics.avgMemoryUsage = totalMemory / memoryCount;
      }

      return metrics;
    } catch (error) {
      this.logger.error('Error fetching system health metrics:', error);
      throw error;
    }
  }

  /**
   * Mark system log as resolved
   */
  async resolveLog(logId: string): Promise<void> {
    const client = this.supabase.getServiceClient();

    try {
      const { error } = await client
        .from('system_logs')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', logId);

      if (error) {
        throw error;
      }
    } catch (error) {
      this.logger.error('Error resolving system log:', error);
      throw error;
    }
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024); // Convert to MB
  }
}
