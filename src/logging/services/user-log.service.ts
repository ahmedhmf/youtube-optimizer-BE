import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from 'src/supabase/supabase.service';
import { UserLogData, LogSeverity, LogType } from '../dto/log.types';

@Injectable()
export class UserLogService {
  private readonly logger = new Logger(UserLogService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Log user activity
   * NOTE: Only logs CRITICAL user events to Supabase for long-term storage
   * Routine activities are logged via Winston file logging
   */
  async logActivity(data: UserLogData): Promise<void> {
    // Define critical user events that should be stored in Supabase
    const criticalActivityTypes = [
      'user_registration',
      'user_login',
      'user_logout',
      'user_registration_failed',
      'password_change',
      'password_reset',
      'email_change',
      'account_deletion',
      'subscription_change',
      'payment_success',
      'payment_failed',
      'two_factor_enabled',
      'two_factor_disabled',
    ];

    const isCritical = 
      criticalActivityTypes.includes(data.activityType) ||
      data.severity === LogSeverity.ERROR ||
      data.severity === LogSeverity.CRITICAL ||
      data.logType === LogType.SECURITY;

    if (!isCritical) {
      // Skip Supabase logging for routine activities - Winston handles this
      return;
    }

    const client = this.supabase.getServiceClient();

    try {
      const { error } = await client.from('user_logs').insert({
        user_id: data.userId || null,
        log_type: data.logType,
        activity_type: data.activityType,
        description: data.description,
        severity: data.severity || LogSeverity.INFO,
        ip_address: data.ipAddress || null,
        user_agent: data.userAgent || null,
        device_id: data.deviceId || null,
        session_id: data.sessionId || null,
        request_id: data.requestId || null,
        metadata: data.metadata || {},
        stack_trace: data.stackTrace || null,
        created_at: new Date().toISOString(),
      });

      if (error) {
        this.logger.error('Failed to log critical user activity:', error);
        // Store in fallback mechanism (see Step 8)
        void this.storeFallback('user_logs', data);
      }
    } catch (error) {
      this.logger.error('Exception logging critical user activity:', error);
      void this.storeFallback('user_logs', data);
    }
  }

  /**
   * Get user logs with filters
   */
  async getUserLogs(
    userId: string,
    filters?: {
      logType?: LogType;
      severity?: LogSeverity;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ) {
    const client = this.supabase.getServiceClient();

    try {
      let query = client
        .from('user_logs')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (filters?.logType) {
        query = query.eq('log_type', filters.logType);
      }

      if (filters?.severity) {
        query = query.eq('severity', filters.severity);
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
      this.logger.error('Error fetching user logs:', error);
      throw error;
    }
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(userId: string, days: number = 30) {
    const client = this.supabase.getServiceClient();

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await client
        .from('user_logs')
        .select('activity_type, log_type, severity')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString());

      if (error) {
        throw error;
      }

      const summary = (data || []).reduce(
        (
          acc: Record<
            string,
            { count: number; severities: Record<string, number> }
          >,
          log: { activity_type: string; severity: string },
        ) => {
          const key = log.activity_type;
          if (!acc[key]) {
            acc[key] = { count: 0, severities: {} };
          }
          acc[key].count++;
          acc[key].severities[log.severity] =
            (acc[key].severities[log.severity] || 0) + 1;
          return acc;
        },
        {},
      );

      return summary;
    } catch (error) {
      this.logger.error('Error fetching user activity summary:', error);
      throw error;
    }
  }

  /**
   * Fallback storage for failed log writes
   */
  private storeFallback(table: string, data: UserLogData): void {
    try {
      const fallbackLog = {
        timestamp: new Date().toISOString(),
        table,
        data,
      };

      this.logger.warn('Stored log in fallback:', fallbackLog);
    } catch (error) {
      this.logger.error('Fallback storage also failed:', error);
    }
  }
}
