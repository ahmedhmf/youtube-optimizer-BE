import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditEventCategory } from './types/audit-event-category.type';
import { AuditEventType } from './types/audit-event.type';
import { AuditEventData } from './types/audit-events-data.type';
import { AuditSeverity } from './types/audit-severity.type';
import { AuditStatus } from './types/audit-status.type';
import { SecurityEvent } from './types/security-event.type';

@Injectable()
export class AuditLoggingService {
  private readonly logger = new Logger(AuditLoggingService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Log an audit event
   */
  async logEvent(eventData: AuditEventData): Promise<void> {
    try {
      const client = this.supabaseService.getServiceClient();

      const auditRecord = {
        user_id: eventData.userId || null,
        event_type: eventData.eventType,
        event_category:
          eventData.eventCategory ||
          this.getDefaultCategory(eventData.eventType),
        severity: eventData.severity || AuditSeverity.INFO,
        status: eventData.status || AuditStatus.SUCCESS,
        ip_address: eventData.ipAddress || null,
        user_agent: eventData.userAgent || null,
        device_id: eventData.deviceId || null,
        resource_type: eventData.resourceType || null,
        resource_id: eventData.resourceId || null,
        action: eventData.action || null,
        metadata: eventData.metadata || {},
        request_id: eventData.requestId || null,
        created_at: new Date().toISOString(),
      };

      const { error } = await client
        .from('security_events')
        .insert(auditRecord);

      if (error) {
        this.logger.error('Failed to log audit event:', {
          error: error.message,
          eventType: eventData.eventType,
          userId: eventData.userId,
        });
        throw new Error(`Failed to log audit event: ${error.message}`);
      }

      this.logger.debug(`Audit event logged: ${eventData.eventType}`, {
        userId: eventData.userId,
        eventType: eventData.eventType,
        severity: eventData.severity,
      });

      // Log critical events to console as well
      if (
        eventData.severity === AuditSeverity.CRITICAL ||
        eventData.severity === AuditSeverity.HIGH
      ) {
        this.logger.warn(`CRITICAL AUDIT EVENT: ${eventData.eventType}`, {
          userId: eventData.userId,
          metadata: eventData.metadata,
        });
      }
    } catch (error) {
      this.logger.error('Error in logEvent:', error);
      // Don't throw here to prevent breaking the main application flow
    }
  }

  /**
   * Log authentication events
   */
  async logAuthEvent(
    eventType: AuditEventType,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>,
    status: AuditStatus = AuditStatus.SUCCESS,
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType,
      eventCategory: AuditEventCategory.AUTHENTICATION,
      severity:
        status === AuditStatus.FAILURE
          ? AuditSeverity.MEDIUM
          : AuditSeverity.INFO,
      status,
      ipAddress,
      userAgent,
      metadata,
    });
  }

  /**
   * Log security events
   */
  async logSecurityEvent(
    eventType: AuditEventType,
    severity: AuditSeverity,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType,
      eventCategory: AuditEventCategory.SECURITY,
      severity,
      status: AuditStatus.WARNING,
      ipAddress,
      userAgent,
      metadata,
    });
  }

  /**
   * Log data access events
   */
  async logDataEvent(
    eventType: AuditEventType,
    userId: string,
    resourceType: string,
    resourceId: string,
    action: string,
    ipAddress?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType,
      eventCategory: AuditEventCategory.DATA_MANAGEMENT,
      severity: AuditSeverity.INFO,
      status: AuditStatus.SUCCESS,
      resourceType,
      resourceId,
      action,
      ipAddress,
      metadata,
    });
  }

  /**
   * Log API events
   */
  async logApiEvent(
    eventType: AuditEventType,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
    resourceType?: string,
    action?: string,
    status: AuditStatus = AuditStatus.SUCCESS,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType,
      eventCategory: AuditEventCategory.API,
      severity:
        status === AuditStatus.FAILURE
          ? AuditSeverity.MEDIUM
          : AuditSeverity.INFO,
      status,
      ipAddress,
      userAgent,
      resourceType,
      action,
      metadata,
    });
  }

  /**
   * Get audit events for a user (paginated)
   */
  async getUserAuditEvents(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      eventType?: AuditEventType;
      category?: AuditEventCategory;
      severity?: AuditSeverity;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ): Promise<{
    events: SecurityEvent[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const client = this.supabaseService.getServiceClient();
    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 100);
    const offset = (page - 1) * limit;

    let query = client
      .from('security_events')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    // Apply filters
    if (options.eventType) {
      query = query.eq('event_type', options.eventType);
    }
    if (options.category) {
      query = query.eq('event_category', options.category);
    }
    if (options.severity) {
      query = query.eq('severity', options.severity);
    }
    if (options.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }
    if (options.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch audit events: ${error.message}`);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      events: (data ?? []) as SecurityEvent[],
      total,
      page,
      totalPages,
    };
  }

  /**
   * Get security event statistics
   */
  async getSecurityStats(
    userId?: string,
    timeRange: 'day' | 'week' | 'month' = 'week',
  ): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByCategory: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    recentCriticalEvents: number;
  }> {
    const client = this.supabaseService.getServiceClient();

    let timeFilter: Date;
    switch (timeRange) {
      case 'day':
        timeFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        timeFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        timeFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    let query = client
      .from('security_events')
      .select('event_type, event_category, severity, created_at')
      .gte('created_at', timeFilter.toISOString());

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch security stats: ${error.message}`);
    }

    const events = (data || []) as Array<{
      event_type: string;
      event_category: string;
      severity: string;
      created_at: string;
    }>;
    const stats = {
      totalEvents: events.length,
      eventsByType: {} as Record<string, number>,
      eventsByCategory: {} as Record<string, number>,
      eventsBySeverity: {} as Record<string, number>,
      recentCriticalEvents: 0,
    };

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    events.forEach((event) => {
      // Count by type
      stats.eventsByType[event.event_type] =
        (stats.eventsByType[event.event_type] || 0) + 1;

      // Count by category
      stats.eventsByCategory[event.event_category] =
        (stats.eventsByCategory[event.event_category] || 0) + 1;

      // Count by severity
      stats.eventsBySeverity[event.severity] =
        (stats.eventsBySeverity[event.severity] || 0) + 1;

      // Count recent critical events
      if (
        (event.severity === AuditSeverity.CRITICAL.toString() ||
          event.severity === AuditSeverity.HIGH.toString()) &&
        new Date(event.created_at) > oneDayAgo
      ) {
        stats.recentCriticalEvents++;
      }
    });

    return stats;
  }

  /**
   * Clean up old audit events (older than 6 months)
   */
  async cleanupOldEvents(): Promise<number> {
    const client = this.supabaseService.getServiceClient();

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { error, count } = await client
      .from('security_events')
      .delete()
      .lt('created_at', sixMonthsAgo.toISOString());

    if (error) {
      this.logger.error('Failed to cleanup old audit events:', error);
      throw new Error(`Failed to cleanup old events: ${error.message}`);
    }

    const deletedCount = count || 0;
    this.logger.log(`Cleaned up ${deletedCount} old audit events`);
    return deletedCount;
  }

  /**
   * Get default category for event type
   */
  private getDefaultCategory(eventType: AuditEventType): AuditEventCategory {
    if (
      [
        AuditEventType.LOGIN,
        AuditEventType.LOGOUT,
        AuditEventType.LOGIN_FAILED,
        AuditEventType.TOKEN_REFRESH,
        AuditEventType.PASSWORD_CHANGE,
        AuditEventType.PASSWORD_RESET_REQUEST,
        AuditEventType.PASSWORD_RESET_COMPLETE,
      ].includes(eventType)
    ) {
      return AuditEventCategory.AUTHENTICATION;
    }

    if (
      [
        AuditEventType.SUSPICIOUS_ACTIVITY,
        AuditEventType.SECURITY_BREACH,
        AuditEventType.BRUTE_FORCE_ATTEMPT,
        AuditEventType.UNAUTHORIZED_ACCESS,
      ].includes(eventType)
    ) {
      return AuditEventCategory.SECURITY;
    }

    if (
      [
        AuditEventType.DATA_ACCESS,
        AuditEventType.DATA_EXPORT,
        AuditEventType.DATA_DELETE,
        AuditEventType.AUDIT_CREATE,
        AuditEventType.AUDIT_DELETE,
      ].includes(eventType)
    ) {
      return AuditEventCategory.DATA_MANAGEMENT;
    }

    if (
      [
        AuditEventType.ACCOUNT_REGISTER,
        AuditEventType.ACCOUNT_UPDATE,
        AuditEventType.ACCOUNT_DELETE,
      ].includes(eventType)
    ) {
      return AuditEventCategory.ACCOUNT_MANAGEMENT;
    }

    return AuditEventCategory.SYSTEM;
  }
}
