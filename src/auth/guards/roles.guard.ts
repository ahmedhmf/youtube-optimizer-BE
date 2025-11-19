import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import {
  UserRole,
  ROLE_PERMISSIONS,
  RolePermissions,
} from '../types/roles.types';
import { User } from '../types/user.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from decorator
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Get required permissions from decorator
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles or permissions required, allow access
    if (!requiredRoles && !requiredPermissions) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    if (!request) {
      return false;
    }
    if (!request.user) {
      return false;
    }
    const user: User = request.user as User;

    if (!user || !user.role) {
      return false;
    }

    // Check role-based access
    if (requiredRoles && !requiredRoles.includes(user.role)) {
      return false;
    }

    // Check permission-based access
    if (requiredPermissions) {
      const userPermissions = ROLE_PERMISSIONS[user.role];

      for (const permission of requiredPermissions) {
        if (!this.hasPermission(userPermissions, permission)) {
          return false;
        }
      }
    }

    return true;
  }

  private hasPermission(
    userPermissions: RolePermissions,
    permission: string,
  ): boolean {
    switch (permission) {
      case 'canAccessAdminPanel':
        return userPermissions.canAccessAdminPanel;
      case 'canManageUsers':
        return userPermissions.canManageUsers;
      case 'canDeleteAnyContent':
        return userPermissions.canDeleteAnyContent;
      case 'canViewAllJobs':
        return userPermissions.canViewAllJobs;
      case 'canUsePremiumFeatures':
        return userPermissions.canUsePremiumFeatures;
      default:
        return false;
    }
  }
}
