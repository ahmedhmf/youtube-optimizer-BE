// Notification types and interfaces

export enum NotificationType {
  SYSTEM = 'system',
  PROCESSING = 'processing',
  USAGE = 'usage',
  UPDATE = 'update',
  TIP = 'tip',
  SECURITY = 'security',
}

export enum NotificationSeverity {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

export interface NotificationMetadata {
  videoId?: string;
  videoUrl?: string;
  actionUrl?: string;
  percentage?: number;
  feature?: string;
  deviceInfo?: string;
  ipAddress?: string;
  [key: string]: any;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  severity?: NotificationSeverity;
  actionUrl?: string;
  actionButtonText?: string;
  read: boolean;
  createdAt: Date;
  metadata?: NotificationMetadata;
}

export interface CreateNotificationDto {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  severity?: NotificationSeverity;
  actionUrl?: string;
  actionButtonText?: string;
  metadata?: NotificationMetadata;
}

export interface NotificationFilters {
  type?: NotificationType;
  read?: boolean;
  limit?: number;
  offset?: number;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
}
