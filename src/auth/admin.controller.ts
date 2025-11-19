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
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { UserRole } from '../auth/types/roles.types';
import { AuthService } from '../auth/auth.service';
import { AccountLockoutService } from './account-lockout.service';
import { LockoutCleanupService } from './lockout-cleanup.service';
import { PaginationQueryDto } from '../DTO/pagination-query.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class AdminController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountLockoutService: AccountLockoutService,
    private readonly lockoutCleanupService: LockoutCleanupService,
  ) {}

  @Get('users')
  @RequirePermissions('canAccessAdminPanel')
  getAllUsers(@Query() query: PaginationQueryDto) {
    // Implementation would go here - get paginated users
    return { message: 'Get all users with pagination', query };
  }

  @Get('users/:id')
  @RequirePermissions('canAccessAdminPanel')
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
}
