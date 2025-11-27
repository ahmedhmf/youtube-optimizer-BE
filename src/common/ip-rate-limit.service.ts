import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditLoggingService } from './audit-logging.service';
import { AuditEventType } from './types/audit-event.type';
import { AuditEventCategory } from './types/audit-event-category.type';
import { AuditSeverity } from './types/audit-severity.type';
import { AuditStatus } from './types/audit-status.type';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests in window
  blockDurationMs?: number; // How long to block after limit exceeded
}

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: Date;
  retryAfter?: number; // Seconds until next request allowed
}

export interface IPRateLimitRecord {
  ip_address: string;
  endpoint: string;
  request_count: number;
  window_start: string;
  blocked_until?: string;
  first_request: string;
  last_request: string;
  user_agent?: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class IPRateLimitService {
  private readonly logger = new Logger(IPRateLimitService.name);

  // Default rate limit configurations for different endpoints
  private readonly defaultConfigs: Record<string, RateLimitConfig> = {
    // Authentication endpoints
    'auth/login': {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5, // 5 login attempts per 15 minutes
      blockDurationMs: 30 * 60 * 1000, // Block for 30 minutes after limit
    },
    'auth/register': {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3, // 3 registration attempts per hour
      blockDurationMs: 2 * 60 * 60 * 1000, // Block for 2 hours
    },
    'auth/reset-password': {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3, // 3 reset attempts per hour
      blockDurationMs: 60 * 60 * 1000, // Block for 1 hour
    },

    // API endpoints
    'analyze/video': {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 50, // 50 analyses per hour (protect AI API costs)
      blockDurationMs: 60 * 60 * 1000, // Block for 1 hour
    },
    'analyze/upload': {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 20, // 20 uploads per hour (expensive operation)
      blockDurationMs: 2 * 60 * 60 * 1000, // Block for 2 hours
    },
    'password-security/check': {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 20, // 20 password checks per 5 minutes
      blockDurationMs: 15 * 60 * 1000, // Block for 15 minutes
    },

    // General API access
    default: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 requests per 15 minutes
      blockDurationMs: 30 * 60 * 1000, // Block for 30 minutes
    },
  };

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly auditLoggingService: AuditLoggingService,
  ) {}

  /**
   * Check if an IP address is allowed to make a request to a specific endpoint
   */
  async checkRateLimit(
    ipAddress: string,
    endpoint: string,
    userAgent?: string,
    userId?: string,
  ): Promise<RateLimitResult> {
    const config = this.getConfigForEndpoint(endpoint);
    const now = new Date();
    const windowStart = new Date(now.getTime() - config.windowMs);

    try {
      const client = this.supabaseService.getServiceClient();

      // Get or create rate limit record for this IP and endpoint
      const { data: existingRecord, error: selectError } = await client
        .from('ip_rate_limits')
        .select('*')
        .eq('ip_address', ipAddress)
        .eq('endpoint', endpoint)
        .single<IPRateLimitRecord>();

      if (selectError && selectError.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is fine for new IPs
        this.logger.error('Error checking rate limit:', selectError);
        // Fail open - allow request if database is having issues
        return {
          allowed: true,
          remainingRequests: config.maxRequests - 1,
          resetTime: new Date(now.getTime() + config.windowMs),
        };
      }

      // Check if IP is currently blocked
      if (existingRecord?.blocked_until) {
        const blockedUntil = new Date(existingRecord.blocked_until);
        if (now < blockedUntil) {
          await this.logRateLimitEvent(
            ipAddress,
            endpoint,
            'blocked_request',
            userAgent,
            userId,
          );

          return {
            allowed: false,
            remainingRequests: 0,
            resetTime: blockedUntil,
            retryAfter: Math.ceil(
              (blockedUntil.getTime() - now.getTime()) / 1000,
            ),
          };
        }
      }

      // Check if we need to reset the window
      const shouldResetWindow =
        !existingRecord ||
        new Date(existingRecord.window_start) < windowStart ||
        (existingRecord.blocked_until &&
          now >= new Date(existingRecord.blocked_until));

      let requestCount = 1;
      let actualWindowStart = now;

      if (!shouldResetWindow) {
        requestCount = existingRecord.request_count + 1;
        actualWindowStart = new Date(existingRecord.window_start);
      }

      // Check if limit exceeded
      if (requestCount > config.maxRequests) {
        const blockUntil = config.blockDurationMs
          ? new Date(now.getTime() + config.blockDurationMs)
          : new Date(actualWindowStart.getTime() + config.windowMs);

        // Update record with block
        await client.from('ip_rate_limits').upsert({
          ip_address: ipAddress,
          endpoint: endpoint,
          request_count: requestCount,
          window_start: actualWindowStart.toISOString(),
          blocked_until: blockUntil.toISOString(),
          first_request: existingRecord?.first_request || now.toISOString(),
          last_request: now.toISOString(),
          user_agent: userAgent,
          updated_at: now.toISOString(),
        });

        await this.logRateLimitEvent(
          ipAddress,
          endpoint,
          'limit_exceeded',
          userAgent,
          userId,
          { requestCount, limit: config.maxRequests },
        );

        return {
          allowed: false,
          remainingRequests: 0,
          resetTime: blockUntil,
          retryAfter: Math.ceil((blockUntil.getTime() - now.getTime()) / 1000),
        };
      }

      // Update record with new request
      await client.from('ip_rate_limits').upsert({
        ip_address: ipAddress,
        endpoint: endpoint,
        request_count: requestCount,
        window_start: actualWindowStart.toISOString(),
        blocked_until: null, // Clear any previous block
        first_request: existingRecord?.first_request || now.toISOString(),
        last_request: now.toISOString(),
        user_agent: userAgent,
        updated_at: now.toISOString(),
      });

      const remainingRequests = config.maxRequests - requestCount;
      const resetTime = new Date(actualWindowStart.getTime() + config.windowMs);

      return {
        allowed: true,
        remainingRequests,
        resetTime,
      };
    } catch (error) {
      this.logger.error('Rate limit check failed:', error);
      // Fail open - allow request if there's an error
      return {
        allowed: true,
        remainingRequests: config.maxRequests - 1,
        resetTime: new Date(now.getTime() + config.windowMs),
      };
    }
  }

  /**
   * Get rate limit configuration for a specific endpoint
   */
  private getConfigForEndpoint(endpoint: string): RateLimitConfig {
    // Normalize endpoint (remove leading slash, parameters, etc.)
    const normalizedEndpoint = endpoint
      .replace(/^\//, '') // Remove leading slash
      .split('?')[0] // Remove query parameters
      .split('/')
      .slice(0, 2)
      .join('/'); // Take first two path segments

    return (
      this.defaultConfigs[normalizedEndpoint] || this.defaultConfigs.default
    );
  }

  /**
   * Log rate limit events for monitoring
   */
  private async logRateLimitEvent(
    ipAddress: string,
    endpoint: string,
    eventType: string,
    userAgent?: string,
    userId?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.auditLoggingService.logEvent({
        userId,
        eventType: AuditEventType.API_ACCESS,
        eventCategory: AuditEventCategory.SECURITY,
        severity:
          eventType === 'limit_exceeded'
            ? AuditSeverity.HIGH
            : AuditSeverity.MEDIUM,
        status:
          eventType === 'blocked_request'
            ? AuditStatus.FAILURE
            : AuditStatus.SUCCESS,
        ipAddress,
        userAgent,
        resourceType: 'rate_limit',
        action: eventType,
        metadata: {
          endpoint,
          ...metadata,
        },
      });
    } catch (error) {
      this.logger.error('Failed to log rate limit event:', error);
    }
  }

  /**
   * Manually block an IP address (for admin use)
   */
  async blockIP(
    ipAddress: string,
    durationMs: number,
    reason: string,
    adminUserId?: string,
  ): Promise<void> {
    const client = this.supabaseService.getServiceClient();
    const now = new Date();
    const blockUntil = new Date(now.getTime() + durationMs);

    await client.from('ip_rate_limits').upsert({
      ip_address: ipAddress,
      endpoint: 'manual_block',
      request_count: 999999,
      window_start: now.toISOString(),
      blocked_until: blockUntil.toISOString(),
      first_request: now.toISOString(),
      last_request: now.toISOString(),
      updated_at: now.toISOString(),
    });

    await this.auditLoggingService.logEvent({
      userId: adminUserId,
      eventType: AuditEventType.ADMIN_ACCESS,
      eventCategory: AuditEventCategory.SECURITY,
      severity: AuditSeverity.HIGH,
      status: AuditStatus.SUCCESS,
      resourceType: 'ip_address',
      action: 'manual_block',
      metadata: {
        targetIp: ipAddress,
        reason,
        durationMs,
        blockUntil: blockUntil.toISOString(),
      },
    });

    this.logger.warn(
      `IP ${ipAddress} manually blocked by admin ${adminUserId}: ${reason}`,
    );
  }

  /**
   * Unblock an IP address (for admin use)
   */
  async unblockIP(ipAddress: string, adminUserId?: string): Promise<void> {
    const client = this.supabaseService.getServiceClient();

    await client
      .from('ip_rate_limits')
      .update({
        blocked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('ip_address', ipAddress);

    await this.auditLoggingService.logEvent({
      userId: adminUserId,
      eventType: AuditEventType.ADMIN_ACCESS,
      eventCategory: AuditEventCategory.SECURITY,
      severity: AuditSeverity.MEDIUM,
      status: AuditStatus.SUCCESS,
      resourceType: 'ip_address',
      action: 'manual_unblock',
      metadata: {
        targetIp: ipAddress,
      },
    });

    this.logger.log(`IP ${ipAddress} unblocked by admin ${adminUserId}`);
  }

  /**
   * Get rate limit statistics for monitoring
   */
  async getRateLimitStats(adminUserId?: string): Promise<{
    totalBlocked: number;
    currentlyBlocked: number;
    topOffenders: Array<{ ip: string; requestCount: number; endpoint: string }>;
  }> {
    const client = this.supabaseService.getServiceClient();
    const now = new Date();

    const { data: stats } = await client
      .from('ip_rate_limits')
      .select('*')
      .order('request_count', { ascending: false });

    if (!stats) {
      return { totalBlocked: 0, currentlyBlocked: 0, topOffenders: [] };
    }

    const typedStats = stats as IPRateLimitRecord[];

    const totalBlocked = typedStats.filter((s) => s.blocked_until).length;
    const currentlyBlocked = typedStats.filter(
      (s) => s.blocked_until && new Date(s.blocked_until) > now,
    ).length;

    const topOffenders = typedStats.slice(0, 10).map((s) => ({
      ip: s.ip_address,
      requestCount: s.request_count,
      endpoint: s.endpoint,
    }));

    // Log admin access to rate limit stats
    if (adminUserId) {
      await this.auditLoggingService.logEvent({
        userId: adminUserId,
        eventType: AuditEventType.DATA_ACCESS,
        eventCategory: AuditEventCategory.SECURITY,
        severity: AuditSeverity.LOW,
        status: AuditStatus.SUCCESS,
        resourceType: 'rate_limit_stats',
        action: 'view',
        metadata: { totalBlocked, currentlyBlocked },
      });
    }

    return { totalBlocked, currentlyBlocked, topOffenders };
  }

  /**
   * Clean up old rate limit records (call this periodically)
   */
  async cleanupOldRecords(): Promise<void> {
    const client = this.supabaseService.getServiceClient();
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    const { error } = await client
      .from('ip_rate_limits')
      .delete()
      .lt('updated_at', cutoffDate.toISOString())
      .is('blocked_until', null);

    if (error) {
      this.logger.error('Failed to cleanup old rate limit records:', error);
    } else {
      this.logger.log('Cleaned up old rate limit records');
    }
  }
}
