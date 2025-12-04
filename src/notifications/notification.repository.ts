import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  Notification,
  CreateNotificationDto,
  NotificationFilters,
  NotificationStats,
  NotificationType,
  DBNotification,
} from './models/notification.types';

import { NotificationSeverity } from './models/notification.types';

@Injectable()
export class NotificationRepository {
  private readonly logger = new Logger(NotificationRepository.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Create a new notification
   */
  async createNotification(
    dto: CreateNotificationDto,
  ): Promise<Notification | null> {
    try {
      // Use service client to bypass RLS for system-generated notifications
      const client = this.supabase.getServiceClient();

      // Debug log to verify DTO structure
      this.logger.debug(
        `Creating notification with DTO: ${JSON.stringify({
          userId: dto.userId,
          type: dto.type,
          severity: dto.severity,
        })}`,
      );

      const { data, error } = await client
        .from('notifications')
        .insert({
          user_id: dto.userId,
          title: dto.title,
          message: dto.message,
          type: dto.type,
          severity: dto.severity || NotificationSeverity.INFO,
          action_url: dto.actionUrl,
          action_button_text: dto.actionButtonText,
          callback: dto.callback,
          metadata: dto.metadata || {},
        })
        .select()
        .single<DBNotification>();

      if (error || !data) {
        this.logger.error('Failed to create notification', error);
        throw new Error(
          error instanceof Error
            ? error.message
            : 'Failed to create notification',
        );
      }

      return this.mapToNotification(data);
    } catch (error) {
      this.logger.error('Error creating notification', error);
      return null;
    }
  }

  /**
   * Get user notifications with filters and pagination
   */
  async getUserNotifications(
    userId: string,
    filters: NotificationFilters = {},
  ): Promise<{ notifications: Notification[]; total: number }> {
    try {
      const client = this.supabase.getClient();
      const { type, read, limit = 20, offset = 0 } = filters;

      let query = client
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (type !== undefined) {
        query = query.eq('type', type);
      }

      if (read !== undefined) {
        query = query.eq('read', read);
      }

      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query.returns<DBNotification[]>();

      if (error) {
        this.logger.error('Failed to fetch notifications', error);
        throw new Error(error.message);
      }

      return {
        notifications: (data || []).map((item) => this.mapToNotification(item)),
        total: count || 0,
      };
    } catch (error) {
      this.logger.error('Error fetching notifications', error);
      return { notifications: [], total: 0 };
    }
  }

  /**
   * Get unread notifications count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const client = this.supabase.getClient();

      const { count, error } = await client
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        this.logger.error('Failed to count unread notifications', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      this.logger.error('Error counting unread notifications', error);
      return 0;
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(userId: string): Promise<NotificationStats> {
    try {
      const client = this.supabase.getClient();

      // Get total and unread counts
      const [totalResult, unreadResult, byTypeResult] = await Promise.all([
        client
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId),
        client
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('read', false),
        client.from('notifications').select('type').eq('user_id', userId),
      ]);

      // Count by type
      const byType = {} as Record<NotificationType, number>;
      Object.values(NotificationType).forEach((type) => {
        byType[type] = 0;
      });

      if (byTypeResult.data) {
        byTypeResult.data.forEach(
          (item: { type?: NotificationType; count?: number }) => {
            if (item.type) {
              byType[item.type] = (byType[item.type] || 0) + 1;
            }
          },
        );
      }

      return {
        total: totalResult.count || 0,
        unread: unreadResult.count || 0,
        byType,
      };
    } catch (error) {
      this.logger.error('Error fetching notification stats', error);
      return {
        total: 0,
        unread: 0,
        byType: {} as Record<NotificationType, number>,
      };
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    try {
      const client = this.supabase.getClient();

      const { error } = await client
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        this.logger.error('Failed to mark notification as read', error);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error marking notification as read', error);
      return false;
    }
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(
    userId: string,
    notificationIds: string[],
  ): Promise<boolean> {
    try {
      const client = this.supabase.getClient();

      const { error } = await client
        .from('notifications')
        .update({ read: true })
        .in('id', notificationIds)
        .eq('user_id', userId);

      if (error) {
        this.logger.error('Failed to mark notifications as read', error);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error marking notifications as read', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const client = this.supabase.getClient();

      const { error } = await client
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        this.logger.error('Failed to mark all notifications as read', error);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error marking all notifications as read', error);
      return false;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(
    userId: string,
    notificationId: string,
  ): Promise<boolean> {
    try {
      const client = this.supabase.getClient();

      const { error } = await client
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        this.logger.error('Failed to delete notification', error);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error deleting notification', error);
      return false;
    }
  }

  /**
   * Delete old read notifications (cleanup)
   */
  async deleteOldReadNotifications(daysOld: number = 30): Promise<number> {
    try {
      const client = this.supabase.getClient();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { data, error } = await client
        .from('notifications')
        .delete()
        .eq('read', true)
        .lt('created_at', cutoffDate.toISOString())
        .select();

      if (error) {
        this.logger.error('Failed to delete old notifications', error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      this.logger.error('Error deleting old notifications', error);
      return 0;
    }
  }

  /**
   * Map database row to Notification object
   */
  private mapToNotification(data: DBNotification): Notification {
    return {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      message: data.message,
      type: data.type,
      severity: data.severity,
      actionUrl: data.action_url ?? undefined,
      actionButtonText: data.action_button_text ?? undefined,
      callback: data.callback ?? undefined,
      read: data.read,
      createdAt: new Date(data.created_at),
      metadata: data.metadata,
    };
  }
}
