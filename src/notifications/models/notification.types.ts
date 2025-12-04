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
  callback?: string;
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
  callback?: string;
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

// Queue-related types for real-time updates
export enum QueueEventType {
  JOB_QUEUED = 'job-queued',
  JOB_STARTED = 'job-started',
  JOB_PROGRESS = 'job-progress',
  JOB_COMPLETED = 'job-completed',
  JOB_FAILED = 'job-failed',
  JOB_CANCELLED = 'job-cancelled',
}

export interface QueueUpdatePayload {
  jobId: string;
  eventType: QueueEventType;
  progress?: number;
  stage?: string;
  message?: string;
  error?: string;
  result?: any;
  metadata?: {
    videoTitle?: string;
    videoUrl?: string;
    jobType?: string;
    [key: string]: any;
  };
}

export interface DBNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  severity: NotificationSeverity;
  action_url: string | null;
  action_button_text: string | null;
  callback: string | null;
  read: boolean;
  created_at: string;
  metadata: Record<string, unknown>;
}
