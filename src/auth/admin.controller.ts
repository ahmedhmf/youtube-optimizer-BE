import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { UserRole } from '../auth/types/roles.types';
import { AuthService } from '../auth/auth.service';
import { PaginationQueryDto } from '../DTO/pagination-query.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class AdminController {
  constructor(private readonly authService: AuthService) {}

  @Get('users')
  @RequirePermissions('canAccessAdminPanel')
  async getAllUsers(@Query() query: PaginationQueryDto) {
    // Implementation would go here - get paginated users
    return { message: 'Get all users with pagination', query };
  }

  @Get('users/:id')
  @RequirePermissions('canAccessAdminPanel')
  async getUser(@Param('id') userId: string) {
    return await this.authService.getProfile(userId);
  }

  @Put('users/:id/role')
  @RequirePermissions('canManageUsers')
  async updateUserRole(
    @Param('id') userId: string,
    @Body() body: { role: UserRole },
  ) {
    // Implementation would go here - update user role
    return { message: `Update user ${userId} role to ${body.role}` };
  }

  @Delete('users/:id')
  @RequirePermissions('canManageUsers')
  async deleteUser(@Param('id') userId: string) {
    // Implementation would go here - delete user
    return { message: `Delete user ${userId}` };
  }

  @Get('analytics')
  @RequirePermissions('canAccessAdminPanel')
  async getAnalytics() {
    // Implementation would go here - get system analytics
    return {
      totalUsers: 0,
      totalJobs: 0,
      activeJobs: 0,
      // Add more analytics
    };
  }
}