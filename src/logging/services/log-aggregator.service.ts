// src/logging/services/log-aggregator.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { UserLogService } from './user-log.service';
import { ErrorLogService } from './error-log.service';
import { ApiLogService } from './api-log.service';
import { SystemLogService } from './system-log.service';
import { SupabaseService } from 'src/supabase/supabase.service';
import {
  UserLogData,
  ErrorLogData,
  VideoAnalysisLogData,
  ApiLogData,
  SystemLogData,
  AuditTrailData,
  LogSeverity,
} from '../dto/log.types';
import { VideoAnalysisLogService } from './video-analysis-log.servce';

@Injectable()
export class LogAggregatorService {
  private readonly logger = new Logger(LogAggregatorService.name);

  constructor(
    private readonly userLogService: UserLogService,
    private readonly errorLogService: ErrorLogService,
    private readonly videoAnalysisLogService: VideoAnalysisLogService,
    private readonly apiLogService: ApiLogService,
    private readonly systemLogService: SystemLogService,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * Universal logging method - routes to appropriate service
   */
  async log(type: string, data: any): Promise<void> {
    try {
      switch (type) {
        case 'user':
        case 'activity':
          await this.userLogService.logActivity(data as UserLogData);
          break;
        case 'error':
          await this.errorLogService.logError(data as ErrorLogData);
          break;
        case 'video_analysis':
          await this.videoAnalysisLogService.createLog(
            data as VideoAnalysisLogData,
          );
          break;
        case 'api':
          await this.apiLogService.logRequest(data as ApiLogData);
          break;
        case 'system':
          await this.systemLogService.logSystem(data as SystemLogData);
          break;
        case 'audit':
          await this.logAuditTrail(data as AuditTrailData);
          break;
        default:
          this.logger.warn(`Unknown log type: ${type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to log ${type}:`, error);
    }
  }

  /**
   * Log audit trail for critical operations
   */
  async logAuditTrail(data: AuditTrailData): Promise<void> {
    const client = this.supabase.getServiceClient();

    try {
      const { error } = await client.from('audit_trail').insert({
        actor_id: data.actorId || null,
        actor_email: data.actorEmail || null,
        actor_role: data.actorRole || null,
        action: data.action,
        entity_type: data.entityType,
        entity_id: data.entityId || null,
        old_values: data.oldValues || null,
        new_values: data.newValues || null,
        changes: data.changes || null,
        ip_address: data.ipAddress || null,
        user_agent: data.userAgent || null,
        session_id: data.sessionId || null,
        request_id: data.requestId || null,
        reason: data.reason || null,
        metadata: data.metadata || {},
        created_at: new Date().toISOString(),
      });

      if (error) {
        throw error;
      }

      this.logger.log(
        `Audit trail logged: ${data.action} on ${data.entityType}`,
      );
    } catch (error) {
      this.logger.error('Failed to log audit trail:', error);
    }
  }

  /**
   * Get comprehensive logs for admin dashboard
   */
  async getComprehensiveLogs(filters?: {
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    severity?: LogSeverity;
    limit?: number;
  }) {
    try {
      const [userLogs, errorLogs, videoLogs, apiLogs, systemLogs] =
        await Promise.all([
          this.userLogService.getUserLogs(filters?.userId || '', {
            startDate: filters?.startDate,
            endDate: filters?.endDate,
            severity: filters?.severity,
            limit: filters?.limit || 50,
          }),
          this.errorLogService.getErrorLogs({
            userId: filters?.userId,
            startDate: filters?.startDate,
            endDate: filters?.endDate,
            severity: filters?.severity,
            limit: filters?.limit || 50,
          }),
          this.videoAnalysisLogService.getLogs({
            userId: filters?.userId,
            startDate: filters?.startDate,
            endDate: filters?.endDate,
            limit: filters?.limit || 50,
          }),
          this.apiLogService.getLogs({
            userId: filters?.userId,
            startDate: filters?.startDate,
            endDate: filters?.endDate,
            limit: filters?.limit || 50,
          }),
          this.systemLogService.getLogs({
            startDate: filters?.startDate,
            endDate: filters?.endDate,
            logLevel: filters?.severity,
            limit: filters?.limit || 50,
          }),
        ]);

      return {
        userLogs: userLogs.data,
        errorLogs: errorLogs.data,
        videoAnalysisLogs: videoLogs.data,
        apiLogs: apiLogs.data,
        systemLogs: systemLogs.data,
        totalCounts: {
          userLogs: userLogs.total,
          errorLogs: errorLogs.total,
          videoAnalysisLogs: videoLogs.total,
          apiLogs: apiLogs.total,
          systemLogs: systemLogs.total,
        },
      };
    } catch (error) {
      this.logger.error('Error fetching comprehensive logs:', error);
      throw error;
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(days: number = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [errorStats, videoStats, apiPerformance, systemHealth] =
        await Promise.all([
          this.errorLogService.getErrorStatistics(days),
          this.videoAnalysisLogService.getStatistics(undefined, days),
          this.apiLogService.getPerformanceStats(days * 24),
          this.systemLogService.getHealthMetrics(),
        ]);

      return {
        errors: errorStats,
        videoAnalysis: videoStats,
        apiPerformance,
        systemHealth,
        period: {
          days,
          startDate,
          endDate: new Date(),
        },
      };
    } catch (error) {
      this.logger.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Search across all log types
   */
  async searchLogs(searchTerm: string) {
    const client = this.supabase.getServiceClient();

    try {
      const searches = await Promise.all([
        // Search user logs
        client
          .from('user_logs')
          .select('*')
          .or(
            `description.ilike.%${searchTerm}%,activity_type.ilike.%${searchTerm}%`,
          )
          .limit(20),

        // Search error logs
        client
          .from('error_logs')
          .select('*')
          .or(`message.ilike.%${searchTerm}%,error_type.ilike.%${searchTerm}%`)
          .limit(20),

        // Search video analysis logs
        client
          .from('video_analysis_logs')
          .select('*')
          .or(
            `video_title.ilike.%${searchTerm}%,video_id.ilike.%${searchTerm}%`,
          )
          .limit(20),

        // Search system logs
        client
          .from('system_logs')
          .select('*')
          .or(
            `message.ilike.%${searchTerm}%,service_name.ilike.%${searchTerm}%`,
          )
          .limit(20),
      ]);

      return {
        userLogs: searches[0].data || [],
        errorLogs: searches[1].data || [],
        videoAnalysisLogs: searches[2].data || [],
        systemLogs: searches[3].data || [],
      };
    } catch (error) {
      this.logger.error('Error searching logs:', error);
      throw error;
    }
  }

  /**
   * Export logs for a user (GDPR compliance)
   */
  async exportUserLogs(userId: string) {
    try {
      const logs = await this.getComprehensiveLogs({
        userId,
        limit: 10000, // Export all
      });

      return {
        userId,
        exportedAt: new Date().toISOString(),
        ...logs,
      };
    } catch (error) {
      this.logger.error('Error exporting user logs:', error);
      throw error;
    }
  }

  /**
   * Delete user logs (GDPR right to be forgotten)
   */
  async deleteUserLogs(userId: string): Promise<void> {
    const client = this.supabase.getServiceClient();

    try {
      await Promise.all([
        client.from('user_logs').delete().eq('user_id', userId),
        client.from('error_logs').delete().eq('user_id', userId),
        client.from('video_analysis_logs').delete().eq('user_id', userId),
        client.from('api_request_logs').delete().eq('user_id', userId),
        client.from('audit_trail').delete().eq('actor_id', userId),
      ]);

      this.logger.log(`Deleted all logs for user ${userId}`);
    } catch (error) {
      this.logger.error('Error deleting user logs:', error);
      throw error;
    }
  }
}
