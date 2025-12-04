import { Injectable, Logger } from '@nestjs/common';
import { NotificationRepository } from './notification.repository';
import {
  Notification,
  NotificationType,
  NotificationFilters,
  NotificationStats,
  NotificationMetadata,
  NotificationSeverity,
} from './models/notification.types';

interface INotificationGateway {
  sendNotificationToUser(
    userId: string,
    notification: Notification,
  ): Promise<void>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private notificationGateway?: INotificationGateway; // Will be set by gateway

  constructor(private readonly repository: NotificationRepository) {}

  /**
   * Set gateway reference (called by gateway on init)
   */
  setGateway(gateway: INotificationGateway): void {
    this.notificationGateway = gateway;
  }

  // ========================================
  // Core Notification Methods
  // ========================================

  /**
   * Send a notification to a user
   */
  async sendNotification(
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
    metadata?: NotificationMetadata,
    severity?: NotificationSeverity,
    actionUrl?: string,
    actionButtonText?: string,
    callback?: string,
  ): Promise<Notification | null> {
    this.logger.log(`Sending ${type} notification to user ${userId}: ${title}`);

    const notification = await this.repository.createNotification({
      userId,
      title,
      message,
      type,
      metadata: metadata || {},
      severity: severity || NotificationSeverity.INFO,
      actionUrl,
      actionButtonText,
      callback,
    });

    // Send via WebSocket if user is connected
    if (notification && this.notificationGateway) {
      try {
        await this.notificationGateway.sendNotificationToUser(
          userId,
          notification,
        );
      } catch (error) {
        this.logger.error('Failed to send WebSocket notification:', error);
        // Continue anyway - notification is saved in DB
      }
    }

    return notification;
  }

  /**
   * Get user notifications with filters
   */
  async getUserNotifications(
    userId: string,
    filters?: NotificationFilters,
  ): Promise<{ notifications: Notification[]; total: number }> {
    return this.repository.getUserNotifications(userId, filters);
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.repository.getUnreadCount(userId);
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(userId: string): Promise<NotificationStats> {
    return this.repository.getNotificationStats(userId);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    return this.repository.markAsRead(userId, notificationId);
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(
    userId: string,
    notificationIds: string[],
  ): Promise<boolean> {
    return this.repository.markMultipleAsRead(userId, notificationIds);
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    return this.repository.markAllAsRead(userId);
  }

  /**
   * Delete a notification
   */
  async deleteNotification(
    userId: string,
    notificationId: string,
  ): Promise<boolean> {
    return this.repository.deleteNotification(userId, notificationId);
  }

  // ========================================
  // Category-Specific Notification Helpers
  // ========================================

  // SYSTEM NOTIFICATIONS
  async notifySubscriptionExpiring(
    userId: string,
    daysLeft: number,
  ): Promise<Notification | null> {
    return this.sendNotification(
      userId,
      'Subscription Expiring Soon',
      `Your subscription will expire in ${daysLeft} days. Renew now to avoid interruption.`,
      NotificationType.SYSTEM,
      { daysLeft, actionUrl: '/settings/subscription' },
    );
  }

  async notifyPaymentFailed(userId: string): Promise<Notification | null> {
    return this.sendNotification(
      userId,
      'Payment Failed',
      'We could not process your payment. Please update your payment method.',
      NotificationType.SYSTEM,
      { actionUrl: '/settings/billing' },
    );
  }

  async notifyEmailNotVerified(userId: string): Promise<Notification | null> {
    return this.sendNotification(
      userId,
      'Email Not Verified',
      'Please verify your email address to access all features.',
      NotificationType.SYSTEM,
      { actionUrl: '/settings/profile' },
    );
  }

  async notifyMonthlyQuotaReached(
    userId: string,
  ): Promise<Notification | null> {
    return this.sendNotification(
      userId,
      'Monthly Quota Reached',
      'You have reached your monthly video analysis limit. Upgrade your plan to continue.',
      NotificationType.SYSTEM,
      { actionUrl: '/settings/subscription' },
    );
  }

  // PROCESSING NOTIFICATIONS
  async notifyAnalysisStarted(
    userId: string,
    videoId: string,
    videoUrl?: string,
  ): Promise<Notification | null> {
    return this.sendNotification(
      userId,
      'AI Analysis Started',
      "Your video is being analyzed. We'll notify you when it's complete.",
      NotificationType.PROCESSING,
      { videoId, videoUrl },
    );
  }

  async notifyAnalysisCompleted(
    userId: string,
    videoId: string,
    videoUrl?: string,
  ): Promise<Notification | null> {
    return this.sendNotification(
      userId,
      'AI Analysis Completed',
      'Your video analysis is ready! View the results now.',
      NotificationType.PROCESSING,
      { videoId, videoUrl, actionUrl: `/results/${videoId}` },
    );
  }

  async notifyThumbnailGenerated(
    userId: string,
    videoId: string,
  ): Promise<Notification | null> {
    return this.sendNotification(
      userId,
      'Thumbnail Generation Complete',
      'Your AI-generated thumbnail ideas are ready to view.',
      NotificationType.PROCESSING,
      { videoId, actionUrl: `/results/${videoId}` },
    );
  }

  async notifyProcessingFailed(
    userId: string,
    videoId: string,
    reason: string,
  ): Promise<Notification | null> {
    return this.sendNotification(
      userId,
      'Video Processing Failed',
      `We encountered an error: ${reason}. Please try again.`,
      NotificationType.PROCESSING,
      { videoId, reason, actionUrl: '/support' },
    );
  }

  async notifyMissingTranscript(
    userId: string,
    videoId: string,
  ): Promise<Notification | null> {
    return this.sendNotification(
      userId,
      'Missing Transcript',
      'This video does not have a transcript available. Try uploading the file directly.',
      NotificationType.PROCESSING,
      { videoId, actionUrl: '/upload' },
    );
  }

  // USAGE & LIMITS NOTIFICATIONS
  async notifyUsageThreshold(
    userId: string,
    percentage: number,
  ): Promise<Notification | null> {
    return this.sendNotification(
      userId,
      `${percentage}% of Plan Limit Reached`,
      `You've used ${percentage}% of your monthly video analysis limit.`,
      NotificationType.USAGE,
      { percentage, actionUrl: '/settings/usage' },
    );
  }

  async notifyLowCredits(
    userId: string,
    creditsLeft: number,
  ): Promise<Notification | null> {
    return this.sendNotification(
      userId,
      'Credits Running Low',
      `You have ${creditsLeft} credits remaining. Consider purchasing more to continue.`,
      NotificationType.USAGE,
      { creditsLeft, actionUrl: '/settings/credits' },
    );
  }

  async notifyTierLimitReached(
    userId: string,
    limit: number,
  ): Promise<Notification | null> {
    return this.sendNotification(
      userId,
      'Plan Limit Reached',
      `Your current plan allows only ${limit} videos. Upgrade for unlimited access.`,
      NotificationType.USAGE,
      { limit, actionUrl: '/settings/subscription' },
    );
  }

  // PRODUCT UPDATE NOTIFICATIONS
  async notifyNewFeature(
    userId: string,
    featureName: string,
    description: string,
  ): Promise<Notification | null> {
    return this.sendNotification(
      userId,
      `New Feature: ${featureName}`,
      description,
      NotificationType.UPDATE,
      { feature: featureName, actionUrl: '/whats-new' },
    );
  }

  async notifyModelUpgrade(
    userId: string,
    modelName: string,
  ): Promise<Notification | null> {
    return this.sendNotification(
      userId,
      'AI Model Upgraded',
      `${modelName} is now available! Enjoy improved analysis quality.`,
      NotificationType.UPDATE,
      { model: modelName },
    );
  }

  async notifyPerformanceOptimization(
    userId: string,
    improvement: string,
  ): Promise<Notification | null> {
    return this.sendNotification(
      userId,
      'Performance Improvement',
      improvement,
      NotificationType.UPDATE,
    );
  }

  // TIP & BEST PRACTICES NOTIFICATIONS
  async notifyTip(
    userId: string,
    tipTitle: string,
    tipMessage: string,
  ): Promise<Notification | null> {
    return this.sendNotification(
      userId,
      tipTitle,
      tipMessage,
      NotificationType.TIP,
    );
  }

  // SECURITY NOTIFICATIONS
  async notifyNewDeviceLogin(
    userId: string,
    deviceInfo: string,
    ipAddress: string,
  ): Promise<Notification | null> {
    return this.sendNotification(
      userId,
      'New Device Login Detected',
      `A login was detected from a new device: ${deviceInfo}. If this wasn't you, please secure your account.`,
      NotificationType.SECURITY,
      { deviceInfo, ipAddress, actionUrl: '/settings/security' },
    );
  }

  async notifyPasswordChanged(userId: string): Promise<Notification | null> {
    return this.sendNotification(
      userId,
      'Password Changed',
      "Your password was successfully changed. If you didn't make this change, contact support immediately.",
      NotificationType.SECURITY,
      { actionUrl: '/support' },
    );
  }

  async notifyApiUsageAnomaly(
    userId: string,
    description: string,
  ): Promise<Notification | null> {
    return this.sendNotification(
      userId,
      'Unusual API Activity',
      `We detected unusual API usage: ${description}. Please review your account activity.`,
      NotificationType.SECURITY,
      { description, actionUrl: '/settings/api-keys' },
    );
  }

  // ========================================
  // Cleanup
  // ========================================

  /**
   * Delete old read notifications (maintenance task)
   */
  async cleanupOldNotifications(daysOld: number = 30): Promise<number> {
    this.logger.log(
      `Cleaning up read notifications older than ${daysOld} days`,
    );
    return this.repository.deleteOldReadNotifications(daysOld);
  }
}
