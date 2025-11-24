import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/types/roles.types';
import { IPRateLimitService } from './ip-rate-limit.service';
import { UserLogService } from '../logging/services/user-log.service';
import { LogSeverity, LogType } from '../logging/dto/log.types';

class BlockIPDto {
  ipAddress: string;
  durationMinutes: number;
  reason: string;
}

@ApiTags('IP Rate Limiting Administration')
@Controller('admin/rate-limits')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class IPRateLimitController {
  constructor(
    private readonly rateLimitService: IPRateLimitService,
    private readonly userLogService: UserLogService,
  ) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Get Rate Limit Statistics',
    description:
      'Retrieve overview of rate limiting statistics and top offenders',
  })
  @ApiResponse({
    status: 200,
    description: 'Rate limit statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalBlocked: {
          type: 'number',
          description: 'Total number of IPs that have been blocked',
        },
        currentlyBlocked: {
          type: 'number',
          description: 'Number of IPs currently blocked',
        },
        topOffenders: {
          type: 'array',
          description: 'Top 10 IPs with highest request counts',
          items: {
            type: 'object',
            properties: {
              ip: { type: 'string' },
              requestCount: { type: 'number' },
              endpoint: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getStats() {
    return await this.rateLimitService.getRateLimitStats();
  }

  @Post('block')
  @ApiOperation({
    summary: 'Manually Block IP Address',
    description: 'Block an IP address for a specified duration with a reason',
  })
  @ApiBody({
    description: 'IP blocking configuration',
    schema: {
      type: 'object',
      properties: {
        ipAddress: {
          type: 'string',
          description: 'IP address to block',
          example: '192.168.1.100',
        },
        durationMinutes: {
          type: 'number',
          description: 'Block duration in minutes',
          example: 60,
          minimum: 1,
          maximum: 10080, // 1 week
        },
        reason: {
          type: 'string',
          description: 'Reason for blocking',
          example: 'Suspicious activity detected',
          maxLength: 500,
        },
      },
      required: ['ipAddress', 'durationMinutes', 'reason'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'IP address blocked successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        blockedUntil: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid IP address or parameters' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async blockIP(@Body() blockDto: BlockIPDto) {
    const { ipAddress, durationMinutes, reason } = blockDto;

    // Validate IP address format
    if (!this.isValidIPAddress(ipAddress)) {
      throw new BadRequestException('Invalid IP address format');
    }

    // Validate duration (1 minute to 1 week)
    if (durationMinutes < 1 || durationMinutes > 10080) {
      throw new BadRequestException(
        'Duration must be between 1 minute and 1 week (10080 minutes)',
      );
    }

    // Validate reason
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException(
        'Reason must be at least 3 characters long',
      );
    }

    const durationMs = durationMinutes * 60 * 1000;
    const blockedUntil = new Date(Date.now() + durationMs);

    await this.rateLimitService.blockIP(ipAddress, durationMs, reason.trim());

    // Log IP blocking (no req available, using system log)
    await this.userLogService.logActivity({
      logType: LogType.SECURITY,
      activityType: 'admin_ip_blocked',
      description: `Admin manually blocked IP address: ${ipAddress}`,
      severity: LogSeverity.CRITICAL,
      metadata: {
        ipAddress,
        durationMinutes,
        reason: reason.trim(),
        blockedUntil: blockedUntil.toISOString(),
      },
    });

    return {
      message: `IP ${ipAddress} blocked successfully`,
      blockedUntil: blockedUntil.toISOString(),
    };
  }

  @Delete('unblock/:ipAddress')
  @ApiOperation({
    summary: 'Unblock IP Address',
    description: 'Remove block from an IP address',
  })
  @ApiParam({
    name: 'ipAddress',
    description: 'IP address to unblock',
    example: '192.168.1.100',
  })
  @ApiResponse({
    status: 200,
    description: 'IP address unblocked successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid IP address' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async unblockIP(@Param('ipAddress') ipAddress: string) {
    if (!this.isValidIPAddress(ipAddress)) {
      throw new BadRequestException('Invalid IP address format');
    }

    await this.rateLimitService.unblockIP(ipAddress);

    // Log IP unblocking
    await this.userLogService.logActivity({
      logType: LogType.SECURITY,
      activityType: 'admin_ip_unblocked',
      description: `Admin unblocked IP address: ${ipAddress}`,
      severity: LogSeverity.WARNING,
      metadata: {
        ipAddress,
      },
    });

    return {
      message: `IP ${ipAddress} unblocked successfully`,
    };
  }

  @Post('cleanup')
  @ApiOperation({
    summary: 'Cleanup Old Rate Limit Records',
    description: 'Remove old rate limit records to keep database clean',
  })
  @ApiResponse({
    status: 200,
    description: 'Cleanup completed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async cleanupOldRecords() {
    await this.rateLimitService.cleanupOldRecords();

    // Log cleanup operation
    await this.userLogService.logActivity({
      logType: LogType.ACTIVITY,
      activityType: 'admin_rate_limit_cleanup',
      description: 'Admin performed rate limit records cleanup',
      severity: LogSeverity.INFO,
      metadata: {
        operation: 'cleanup_old_records',
      },
    });

    return {
      message: 'Old rate limit records cleaned up successfully',
    };
  }

  @Get('blocked')
  @ApiOperation({
    summary: 'Get Currently Blocked IPs',
    description: 'Retrieve list of currently blocked IP addresses',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'Blocked IPs retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ipAddress: { type: 'string' },
              endpoint: { type: 'string' },
              blockedUntil: { type: 'string', format: 'date-time' },
              requestCount: { type: 'number' },
              lastRequest: { type: 'string', format: 'date-time' },
              userAgent: { type: 'string' },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  getBlockedIPs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    // This would need to be implemented in the service
    // For now, return a placeholder response
    return {
      data: [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: 0,
        totalPages: 0,
      },
    };
  }

  /**
   * Validate IP address format (IPv4 and IPv6)
   */
  private isValidIPAddress(ip: string): boolean {
    // IPv4 validation
    const ipv4Regex =
      /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

    // IPv6 validation (simplified)
    const ipv6Regex =
      /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }
}
