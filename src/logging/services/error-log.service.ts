import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from 'src/supabase/supabase.service';
import { ErrorLogData, LogSeverity, ErrorType } from '../dto/log.types';

@Injectable()
export class ErrorLogService {
  private readonly logger = new Logger(ErrorLogService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Log application error with deduplication
   * NOTE: All errors are considered CRITICAL and logged to Supabase
   * Also logged to Winston files for detailed debugging
   */
  async logError(data: ErrorLogData): Promise<void> {
    const client = this.supabase.getServiceClient();

    try {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const { data: existingError } = (await client
        .from('error_logs')
        .select('id, occurrences')
        .eq('error_type', data.errorType)
        .eq('message', data.message)
        .eq('endpoint', data.endpoint || '')
        .gte('created_at', oneHourAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single()) as { data: { id: string; occurrences: number } | null };

      if (existingError) {
        await client
          .from('error_logs')
          .update({
            occurrences: existingError.occurrences + 1,
            last_occurred_at: new Date().toISOString(),
          })
          .eq('id', existingError.id);

        this.logger.debug(
          `Updated error occurrence count: ${existingError.id}`,
        );
      } else {
        // Insert new error log
        const { error } = await client.from('error_logs').insert({
          error_code: data.errorCode || null,
          error_type: data.errorType,
          message: data.message,
          severity: data.severity || LogSeverity.ERROR,
          stack_trace: data.stackTrace || null,
          context: data.context || {},
          user_id: data.userId || null,
          endpoint: data.endpoint || null,
          method: data.method || null,
          status_code: data.statusCode || null,
          ip_address: data.ipAddress || null,
          user_agent: data.userAgent || null,
          request_id: data.requestId || null,
          resolved: false,
          created_at: new Date().toISOString(),
          first_occurred_at: new Date().toISOString(),
          last_occurred_at: new Date().toISOString(),
          occurrences: 1,
        });

        if (error) {
          this.logger.error('Failed to log error:', error);
          void this.storeFallback(data);
        }
      }

      // Log to console for immediate visibility
      this.logger.error(`[${data.errorType}] ${data.message}`, data.stackTrace);
    } catch (error) {
      this.logger.error('Exception logging error:', error);
      void this.storeFallback(data);
    }
  }

  /**
   * Get error logs with filters
   */
  async getErrorLogs(filters?: {
    errorType?: ErrorType;
    severity?: LogSeverity;
    resolved?: boolean;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const client = this.supabase.getServiceClient();

    try {
      let query = client
        .from('error_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filters?.errorType) {
        query = query.eq('error_type', filters.errorType);
      }

      if (filters?.severity) {
        query = query.eq('severity', filters.severity);
      }

      if (filters?.resolved !== undefined) {
        query = query.eq('resolved', filters.resolved);
      }

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
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
      this.logger.error('Error fetching error logs:', error);
      throw error;
    }
  }

  /**
   * Mark error as resolved
   */
  async resolveError(
    errorId: string,
    resolvedBy: string,
    resolutionNotes?: string,
  ): Promise<void> {
    const client = this.supabase.getServiceClient();

    try {
      const { error } = await client
        .from('error_logs')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy,
          resolution_notes: resolutionNotes || null,
        })
        .eq('id', errorId);

      if (error) {
        throw error;
      }

      this.logger.log(`Error ${errorId} marked as resolved`);
    } catch (error) {
      this.logger.error('Error resolving error log:', error);
      throw error;
    }
  }

  /**
   * Get error statistics
   */
  async getErrorStatistics(days: number = 30) {
    const client = this.supabase.getServiceClient();

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await client
        .from('error_logs')
        .select('error_type, severity, occurrences, resolved')
        .gte('created_at', startDate.toISOString());

      if (error) {
        throw error;
      }

      const stats = {
        totalErrors: 0,
        totalOccurrences: 0,
        byType: {} as Record<string, number>,
        bySeverity: {} as Record<string, number>,
        resolvedCount: 0,
        unresolvedCount: 0,
      };

      (data || []).forEach(
        (log: {
          error_type: string;
          severity: string;
          occurrences: number;
          resolved: boolean;
        }) => {
          stats.totalErrors++;
          stats.totalOccurrences += log.occurrences;

          stats.byType[log.error_type] =
            (stats.byType[log.error_type] || 0) + log.occurrences;
          stats.bySeverity[log.severity] =
            (stats.bySeverity[log.severity] || 0) + log.occurrences;

          if (log.resolved) {
            stats.resolvedCount++;
          } else {
            stats.unresolvedCount++;
          }
        },
      );

      return stats;
    } catch (error) {
      this.logger.error('Error fetching error statistics:', error);
      throw error;
    }
  }

  private storeFallback(data: ErrorLogData): void {
    try {
      const fallbackLog = {
        timestamp: new Date().toISOString(),
        type: 'error_log',
        data,
      };
      this.logger.warn('Stored error log in fallback:', fallbackLog);
    } catch (error) {
      this.logger.error('Fallback storage failed:', error);
    }
  }
}
