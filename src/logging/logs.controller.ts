import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import {
  LogQueryDto,
  SearchLogsDto,
  ErrorLogQueryDto,
  ResolveErrorDto,
  VideoAnalysisLogQueryDto,
  ApiLogQueryDto,
  SystemLogQueryDto,
} from './dto/log-query.dto';
import { ApiLogService } from './services/api-log.service';
import { ErrorLogService } from './services/error-log.service';
import { LogAggregatorService } from './services/log-aggregator.service';
import { SystemLogService } from './services/system-log.service';
import { UserLogService } from './services/user-log.service';
import { LogSeverity, LogType } from './dto/log.types';
import { VideoAnalysisLogService } from './services/video-analysis-log.servce';

@ApiTags('Logs')
@Controller('logs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LogsController {
  constructor(
    private readonly logAggregator: LogAggregatorService,
    private readonly userLogService: UserLogService,
    private readonly errorLogService: ErrorLogService,
    private readonly videoAnalysisLogService: VideoAnalysisLogService,
    private readonly apiLogService: ApiLogService,
    private readonly systemLogService: SystemLogService,
  ) {}

  /**
   * Get comprehensive logs (Admin only)
   */
  @Get('comprehensive')
  @ApiOperation({ summary: 'Get comprehensive logs across all types' })
  @ApiResponse({ status: 200, description: 'Logs retrieved successfully' })
  async getComprehensiveLogs(@Query() query: LogQueryDto) {
    const logs = await this.logAggregator.getComprehensiveLogs({
      userId: query.userId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      severity: query.severity,
      limit: query.limit,
    });

    return {
      message: 'Comprehensive logs retrieved successfully',
      data: logs,
    };
  }

  /**
   * Get dashboard statistics
   */
  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  async getDashboardStats(@Query('days') days?: number) {
    const stats = await this.logAggregator.getDashboardStats(days || 7);

    return {
      message: 'Dashboard statistics retrieved successfully',
      data: stats,
    };
  }

  /**
   * Search across all logs
   */
  @Post('search')
  @ApiOperation({ summary: 'Search across all log types' })
  @ApiResponse({ status: 200, description: 'Search results retrieved' })
  async searchLogs(@Body() searchDto: SearchLogsDto) {
    const results = await this.logAggregator.searchLogs(searchDto.searchTerm, {
      startDate: searchDto.startDate
        ? new Date(searchDto.startDate)
        : undefined,
      endDate: searchDto.endDate ? new Date(searchDto.endDate) : undefined,
    });

    return {
      message: 'Search completed successfully',
      data: results,
    };
  }

  /**
   * Get user logs
   */
  @Get('user/:userId')
  @ApiOperation({ summary: 'Get logs for a specific user' })
  @ApiResponse({ status: 200, description: 'User logs retrieved successfully' })
  async getUserLogs(
    @Param('userId') userId: string,
    @Query() query: LogQueryDto,
  ) {
    const logs = await this.userLogService.getUserLogs(userId, {
      logType: query.logType,
      severity: query.severity,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: query.limit,
      offset: query.offset,
    });

    return {
      message: 'User logs retrieved successfully',
      data: logs.data,
      total: logs.total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  /**
   * Get user activity summary
   */
  @Get('user/:userId/summary')
  @ApiOperation({ summary: 'Get user activity summary' })
  @ApiResponse({ status: 200, description: 'Summary retrieved successfully' })
  async getUserActivitySummary(
    @Param('userId') userId: string,
    @Query('days') days?: number,
  ) {
    const summary = await this.userLogService.getUserActivitySummary(
      userId,
      days || 30,
    );

    return {
      message: 'User activity summary retrieved successfully',
      data: summary,
    };
  }

  /**
   * Get error logs
   */
  @Get('errors')
  @ApiOperation({ summary: 'Get error logs' })
  @ApiResponse({
    status: 200,
    description: 'Error logs retrieved successfully',
  })
  async getErrorLogs(@Query() query: ErrorLogQueryDto) {
    const logs = await this.errorLogService.getErrorLogs({
      errorType: query.errorType,
      severity: query.severity,
      resolved: query.resolved,
      userId: query.userId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: query.limit,
      offset: query.offset,
    });

    return {
      message: 'Error logs retrieved successfully',
      data: logs.data,
      total: logs.total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  /**
   * Get error statistics
   */
  @Get('errors/statistics')
  @ApiOperation({ summary: 'Get error statistics' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  async getErrorStatistics(@Query('days') days?: number) {
    const stats = await this.errorLogService.getErrorStatistics(days || 30);

    return {
      message: 'Error statistics retrieved successfully',
      data: stats,
    };
  }

  /**
   * Resolve error
   */
  @Patch('errors/:errorId/resolve')
  @ApiOperation({ summary: 'Mark error as resolved' })
  @ApiResponse({ status: 200, description: 'Error resolved successfully' })
  async resolveError(
    @Param('errorId') errorId: string,
    @Req() req: any,
    @Body() resolveDto: ResolveErrorDto,
  ) {
    await this.errorLogService.resolveError(
      errorId,
      req.user.id,
      resolveDto.resolutionNotes,
    );

    // Log error resolution
    await this.userLogService.logActivity({
      userId: req.user.id,
      logType: LogType.ACTIVITY,
      activityType: 'admin_error_resolved',
      description: 'Admin resolved an error log',
      severity: LogSeverity.INFO,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown',
      metadata: {
        errorId,
        resolutionNotes: resolveDto.resolutionNotes,
      },
    });

    // Audit trail
    await this.logAggregator.logAuditTrail({
      actorId: req.user.id,
      actorEmail: req.user.email || 'unknown',
      actorRole: req.user.role || 'unknown',
      action: 'resolve_error_log',
      entityType: 'error_log',
      entityId: errorId,
      oldValues: {
        status: 'unresolved',
      },
      newValues: {
        status: 'resolved',
        resolvedBy: req.user.id,
        resolvedAt: new Date().toISOString(),
        resolutionNotes: resolveDto.resolutionNotes,
      },
      changes: ['status', 'resolution'],
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown',
      metadata: {
        errorId,
        resolutionNotes: resolveDto.resolutionNotes,
      },
    });

    return {
      message: 'Error resolved successfully',
    };
  }

  /**
   * Get video analysis logs
   */
  @Get('video-analysis')
  @ApiOperation({ summary: 'Get video analysis logs' })
  @ApiResponse({ status: 200, description: 'Logs retrieved successfully' })
  async getVideoAnalysisLogs(@Query() query: VideoAnalysisLogQueryDto) {
    const logs = await this.videoAnalysisLogService.getLogs({
      userId: query.userId,
      videoId: query.videoId,
      status: query.status,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: query.limit,
      offset: query.offset,
    });

    return {
      message: 'Video analysis logs retrieved successfully',
      data: logs.data,
      total: logs.total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  /**
   * Get video analysis statistics
   */
  @Get('video-analysis/statistics')
  @ApiOperation({ summary: 'Get video analysis statistics' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  async getVideoAnalysisStatistics(
    @Query('userId') userId?: string,
    @Query('days') days?: number,
  ) {
    const stats = await this.videoAnalysisLogService.getStatistics(
      userId,
      days || 30,
    );

    return {
      message: 'Video analysis statistics retrieved successfully',
      data: stats,
    };
  }

  /**
   * Get API logs
   */
  @Get('api')
  @ApiOperation({ summary: 'Get API request logs' })
  @ApiResponse({ status: 200, description: 'API logs retrieved successfully' })
  async getApiLogs(@Query() query: ApiLogQueryDto) {
    const logs = await this.apiLogService.getLogs({
      userId: query.userId,
      endpoint: query.endpoint,
      method: query.method,
      statusCode: query.statusCode,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: query.limit,
      offset: query.offset,
    });

    return {
      message: 'API logs retrieved successfully',
      data: logs.data,
      total: logs.total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  /**
   * Get API performance statistics
   */
  @Get('api/performance')
  @ApiOperation({ summary: 'Get API performance statistics' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  async getApiPerformanceStats(@Query('hours') hours?: number) {
    const stats = await this.apiLogService.getPerformanceStats(hours || 24);

    return {
      message: 'API performance statistics retrieved successfully',
      data: stats,
    };
  }

  /**
   * Get system logs
   */
  @Get('system')
  @ApiOperation({ summary: 'Get system logs' })
  @ApiResponse({
    status: 200,
    description: 'System logs retrieved successfully',
  })
  async getSystemLogs(@Query() query: SystemLogQueryDto) {
    const logs = await this.systemLogService.getLogs({
      logLevel: query.severity,
      category: query.category,
      serviceName: query.serviceName,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: query.limit,
      offset: query.offset,
    });

    return {
      message: 'System logs retrieved successfully',
      data: logs.data,
      total: logs.total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  /**
   * Get system health metrics
   */
  @Get('system/health')
  @ApiOperation({ summary: 'Get system health metrics' })
  @ApiResponse({ status: 200, description: 'Metrics retrieved successfully' })
  async getSystemHealthMetrics() {
    const metrics = await this.systemLogService.getHealthMetrics();

    return {
      message: 'System health metrics retrieved successfully',
      data: metrics,
    };
  }

  /**
   * Export user logs (GDPR)
   */
  @Get('export/:userId')
  @ApiOperation({ summary: 'Export all logs for a user (GDPR)' })
  @ApiResponse({ status: 200, description: 'Logs exported successfully' })
  async exportUserLogs(@Param('userId') userId: string) {
    const logs = await this.logAggregator.exportUserLogs(userId);

    return {
      message: 'User logs exported successfully',
      data: logs,
    };
  }
}
