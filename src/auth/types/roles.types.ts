export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  PREMIUM = 'premium',
}

export interface RolePermissions {
  canAccessAdminPanel: boolean;
  canManageUsers: boolean;
  canDeleteAnyContent: boolean;
  canViewAllJobs: boolean;
  maxJobsPerDay: number;
  canUsePremiumFeatures: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  [UserRole.USER]: {
    canAccessAdminPanel: false,
    canManageUsers: false,
    canDeleteAnyContent: false,
    canViewAllJobs: false,
    maxJobsPerDay: 10,
    canUsePremiumFeatures: false,
  },
  [UserRole.PREMIUM]: {
    canAccessAdminPanel: false,
    canManageUsers: false,
    canDeleteAnyContent: false,
    canViewAllJobs: false,
    maxJobsPerDay: 50,
    canUsePremiumFeatures: true,
  },
  [UserRole.MODERATOR]: {
    canAccessAdminPanel: true,
    canManageUsers: false,
    canDeleteAnyContent: true,
    canViewAllJobs: true,
    maxJobsPerDay: 100,
    canUsePremiumFeatures: true,
  },
  [UserRole.ADMIN]: {
    canAccessAdminPanel: true,
    canManageUsers: true,
    canDeleteAnyContent: true,
    canViewAllJobs: true,
    maxJobsPerDay: -1, // Unlimited
    canUsePremiumFeatures: true,
  },
};