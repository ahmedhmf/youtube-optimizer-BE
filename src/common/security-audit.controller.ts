import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/types/roles.types';
import { AuditLoggingService } from '../common/audit-logging.service';
import { AuditEventCategory } from './types/audit-event-category.type';
import { AuditEventType } from './types/audit-event.type';
import { AuditSeverity } from './types/audit-severity.type';

@ApiTags('Security Audit')
@Controller('audit')
@ApiBearerAuth('access-token')
export class SecurityAuditController {
  constructor(private readonly auditLoggingService: AuditLoggingService) {}

  @Get('events')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get User Audit Events',
    description: 'Retrieves paginated audit events for the authenticated user',
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
    description: 'Items per page (default: 50, max: 100)',
  })
  @ApiQuery({
    name: 'eventType',
    required: false,
    enum: AuditEventType,
    description: 'Filter by event type',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: AuditEventCategory,
    description: 'Filter by event category',
  })
  @ApiQuery({
    name: 'severity',
    required: false,
    enum: AuditSeverity,
    description: 'Filter by severity level',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO string)',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit events retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        events: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              event_type: { type: 'string' },
              event_category: { type: 'string' },
              severity: { type: 'string' },
              status: { type: 'string' },
              ip_address: { type: 'string', nullable: true },
              user_agent: { type: 'string', nullable: true },
              resource_type: { type: 'string', nullable: true },
              resource_id: { type: 'string', nullable: true },
              action: { type: 'string', nullable: true },
              metadata: { type: 'object' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserAuditEvents(
    @Req() req: { user: { id: string } },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('eventType') eventType?: AuditEventType,
    @Query('category') category?: AuditEventCategory,
    @Query('severity') severity?: AuditSeverity,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const userId: string = req.user.id;

    const options = {
      page: page || 1,
      limit: limit || 50,
      eventType,
      category,
      severity,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    return this.auditLoggingService.getUserAuditEvents(userId, options);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get User Security Statistics',
    description:
      'Retrieves security event statistics for the authenticated user',
  })
  @ApiQuery({
    name: 'timeRange',
    required: false,
    enum: ['day', 'week', 'month'],
    description: 'Time range for statistics (default: week)',
  })
  @ApiResponse({
    status: 200,
    description: 'Security statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalEvents: { type: 'number' },
        eventsByType: { type: 'object' },
        eventsByCategory: { type: 'object' },
        eventsBySeverity: { type: 'object' },
        recentCriticalEvents: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserSecurityStats(
    @Req() req: { user: { id: string } },
    @Query('timeRange') timeRange: 'day' | 'week' | 'month' = 'week',
  ) {
    const userId: string = req.user.id;
    return this.auditLoggingService.getSecurityStats(userId, timeRange);
  }

  @Get('admin/events')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get All Security Events (Admin)',
    description: 'Retrieves all security events across the system (admin only)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: String,
    description: 'Filter by specific user',
  })
  @ApiQuery({ name: 'eventType', required: false, enum: AuditEventType })
  @ApiQuery({ name: 'category', required: false, enum: AuditEventCategory })
  @ApiQuery({ name: 'severity', required: false, enum: AuditSeverity })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'All security events retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getAllSecurityEvents(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('userId') userId?: string,
    @Query('eventType') eventType?: AuditEventType,
    @Query('category') category?: AuditEventCategory,
    @Query('severity') severity?: AuditSeverity,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const options = {
      page: page || 1,
      limit: limit || 50,
      eventType,
      category,
      severity,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    // If userId is provided, get events for that user, otherwise get system-wide stats
    if (userId) {
      return this.auditLoggingService.getUserAuditEvents(userId, options);
    } else {
      // Return system-wide statistics
      return this.auditLoggingService.getSecurityStats(undefined, 'month');
    }
  }

  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get System-wide Security Statistics (Admin)',
    description:
      'Retrieves security statistics for the entire system (admin only)',
  })
  @ApiQuery({
    name: 'timeRange',
    required: false,
    enum: ['day', 'week', 'month'],
    description: 'Time range for statistics (default: week)',
  })
  @ApiResponse({
    status: 200,
    description: 'System security statistics retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getSystemSecurityStats(
    @Query('timeRange') timeRange: 'day' | 'week' | 'month' = 'week',
  ) {
    return this.auditLoggingService.getSecurityStats(undefined, timeRange);
  }
}
