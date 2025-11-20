import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { UserRole } from '../auth/types/roles.types';
import { AuthService } from '../auth/auth.service';
import { AccountLockoutService } from './account-lockout.service';
import { LockoutCleanupService } from './lockout-cleanup.service';
import {
  TokenBlacklistService,
  BlacklistReason,
} from './token-blacklist.service';
import { PaginationQueryDto } from '../DTO/pagination-query.dto';

@ApiTags('Admin Management')
@Controller('admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class AdminController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountLockoutService: AccountLockoutService,
    private readonly lockoutCleanupService: LockoutCleanupService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  @Get('users')
  @RequirePermissions('canAccessAdminPanel')
  @ApiOperation({
    summary: 'Get All Users',
    description:
      'Retrieve paginated list of all users in the system. Admin access required.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        query: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  getAllUsers(@Query() query: PaginationQueryDto) {
    // Implementation would go here - get paginated users
    return { message: 'Get all users with pagination', query };
  }

  @Get('users/:id')
  @RequirePermissions('canAccessAdminPanel')
  @ApiOperation({
    summary: 'Get User Details',
    description: 'Retrieve detailed information about a specific user by ID.',
  })
  @ApiParam({ name: 'id', description: 'User ID to retrieve' })
  @ApiResponse({
    status: 200,
    description: 'User details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        name: { type: 'string' },
        role: { type: 'string' },
        created_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUser(@Param('id') userId: string) {
    return await this.authService.getProfile(userId);
  }

  @Put('users/:id/role')
  @Throttle({ default: { limit: 10, ttl: 300000 } }) // 10 role changes per 5 minutes
  @RequirePermissions('canManageUsers')
  updateUserRole(
    @Param('id') userId: string,
    @Body() body: { role: UserRole },
  ) {
    // Implementation would go here - update user role
    return { message: `Update user ${userId} role to ${body.role}` };
  }

  @Delete('users/:id')
  @Throttle({ default: { limit: 5, ttl: 600000 } }) // 5 deletions per 10 minutes
  @RequirePermissions('canManageUsers')
  deleteUser(@Param('id') userId: string) {
    // Implementation would go here - delete user
    return { message: `Delete user ${userId}` };
  }

  @Get('analytics')
  @RequirePermissions('canAccessAdminPanel')
  @ApiOperation({
    summary: 'Get System Analytics',
    description:
      'Retrieve comprehensive system analytics including user counts, job statistics, and platform metrics.',
  })
  @ApiResponse({
    status: 200,
    description: 'System analytics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalUsers: { type: 'number', example: 1250 },
        totalJobs: { type: 'number', example: 5670 },
        activeJobs: { type: 'number', example: 15 },
        completedJobs: { type: 'number', example: 5655 },
        failedJobs: { type: 'number', example: 0 },
        systemHealth: { type: 'string', example: 'healthy' },
      },
    },
  })
  getAnalytics() {
    // Implementation would go here - get system analytics
    return {
      totalUsers: 0,
      totalJobs: 0,
      activeJobs: 0,
      // Add more analytics
    };
  }

  // Account Lockout Management Endpoints
  @Get('lockouts/:identifier/status')
  @RequirePermissions('canAccessAdminPanel')
  @Throttle({ short: { ttl: 1000, limit: 10 } })
  async getLockoutStatus(@Param('identifier') identifier: string) {
    const status =
      await this.accountLockoutService.checkLockoutStatus(identifier);
    return {
      identifier,
      ...status,
      config: this.accountLockoutService.getLockoutConfig(),
    };
  }

  @Post('lockouts/:identifier/reset')
  @RequirePermissions('canAccessAdminPanel')
  @Throttle({ short: { ttl: 1000, limit: 5 } })
  async resetLockout(@Param('identifier') identifier: string) {
    await this.accountLockoutService.resetLockout(identifier);
    return {
      message: `Lockout reset for ${identifier}`,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('lockouts/cleanup')
  @RequirePermissions('canAccessAdminPanel')
  @Throttle({ short: { ttl: 10000, limit: 1 } }) // Very restrictive - once per 10 seconds
  async cleanupExpiredLockouts() {
    const cleanedCount = await this.lockoutCleanupService.manualCleanup();
    return {
      message: 'Lockout cleanup completed',
      recordsRemoved: cleanedCount,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('lockouts/config')
  @RequirePermissions('canAccessAdminPanel')
  getLockoutConfig() {
    return {
      config: this.accountLockoutService.getLockoutConfig(),
      description: {
        maxAttempts: 'Maximum failed attempts before lockout',
        lockoutDurationMinutes: 'How long account stays locked',
        resetWindowMinutes: 'Time window for attempt counting',
      },
    };
  }

  @Get('tokens/blacklist/stats')
  @RequirePermissions('canAccessAdminPanel')
  async getBlacklistStats() {
    const stats = await this.tokenBlacklistService.getBlacklistStats();
    return {
      ...stats,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('tokens/blacklist/:userId')
  @RequirePermissions('canAccessAdminPanel')
  async getUserBlacklistedTokens(@Param('userId') userId: string) {
    const tokens =
      await this.tokenBlacklistService.getUserBlacklistedTokens(userId);
    return {
      userId,
      blacklistedTokens: tokens,
      count: tokens.length,
    };
  }

  @Post('tokens/blacklist/:userId/all')
  @RequirePermissions('canAccessAdminPanel')
  @Throttle({ short: { ttl: 30000, limit: 5 } }) // 5 times per 30 seconds
  async blacklistAllUserTokens(
    @Param('userId') userId: string,
    @Body('reason') reason?: string,
  ) {
    const blacklistReason =
      reason === 'security_breach'
        ? BlacklistReason.SECURITY_BREACH
        : BlacklistReason.ADMIN_REVOKE;

    await this.tokenBlacklistService.blacklistAllUserTokens(
      userId,
      blacklistReason,
    );

    return {
      message: 'All tokens blacklisted for user',
      userId,
      reason: blacklistReason,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('tokens/cleanup')
  @RequirePermissions('canAccessAdminPanel')
  @Throttle({ short: { ttl: 60000, limit: 1 } }) // Once per minute
  async cleanupExpiredTokens() {
    await this.tokenBlacklistService.cleanupExpiredTokens();
    return {
      message: 'Expired tokens cleanup completed',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('users/:userId/disable')
  @RequirePermissions('canAccessAdminPanel')
  @Throttle({ short: { ttl: 30000, limit: 3 } }) // 3 times per 30 seconds
  async disableUserAccount(@Param('userId') userId: string) {
    // Blacklist all tokens for account disabled
    await this.tokenBlacklistService.blacklistAllUserTokens(
      userId,
      BlacklistReason.ACCOUNT_DISABLED,
    );

    return {
      message: 'User account disabled and all tokens revoked',
      userId,
      timestamp: new Date().toISOString(),
    };
  }
}
