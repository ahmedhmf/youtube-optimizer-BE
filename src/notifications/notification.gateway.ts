import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NotificationService } from './notification.service';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { NotificationType } from './models/notification.types';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  namespace: 'notifications',
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

  constructor(
    private readonly notificationService: NotificationService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Handle client connection
   */
  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract token from handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn(`Connection rejected: No token provided`);
        client.disconnect();
        return;
      }

      // Verify token and get user ID
      const userId = await this.verifyToken(token);
      if (!userId) {
        this.logger.warn(`Connection rejected: Invalid token`);
        client.disconnect();
        return;
      }

      // Store user ID in socket
      client.userId = userId;

      // Track user connections
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      this.logger.log(
        `Client connected: ${client.id} (User: ${userId}, Total connections: ${this.userSockets.get(userId)!.size})`,
      );

      // Send initial unread count
      const unreadCount = await this.notificationService.getUnreadCount(userId);
      client.emit('unread-count', { count: unreadCount });

      // Send recent unread notifications
      const { notifications } =
        await this.notificationService.getUserNotifications(userId, {
          read: false,
          limit: 10,
        });
      client.emit('initial-notifications', { notifications });
    } catch (error) {
      this.logger.error('Connection error:', error);
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.userId;
    if (userId) {
      const userSocketSet = this.userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(client.id);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(userId);
        }
      }
      this.logger.log(`Client disconnected: ${client.id} (User: ${userId})`);
    }
  }

  /**
   * Subscribe to notifications (client can request this)
   */
  @UseGuards(WsAuthGuard)
  @SubscribeMessage('subscribe-notifications')
  async handleSubscribe(@ConnectedSocket() client: AuthenticatedSocket) {
    const userId = client.userId;
    if (!userId) return;

    this.logger.log(`User ${userId} subscribed to notifications`);

    // Send current unread count
    const unreadCount = await this.notificationService.getUnreadCount(userId);
    client.emit('unread-count', { count: unreadCount });
  }

  /**
   * Mark notification as read via WebSocket
   */
  @UseGuards(WsAuthGuard)
  @SubscribeMessage('mark-as-read')
  async handleMarkAsRead(
    @MessageBody() data: { notificationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const userId = client.userId;
    if (!userId) return;

    const success = await this.notificationService.markAsRead(
      userId,
      data.notificationId,
    );

    if (success) {
      // Send updated unread count
      const unreadCount = await this.notificationService.getUnreadCount(userId);
      client.emit('unread-count', { count: unreadCount });
      client.emit('marked-as-read', { notificationId: data.notificationId });
    }
  }

  /**
   * Mark all as read via WebSocket
   */
  @UseGuards(WsAuthGuard)
  @SubscribeMessage('mark-all-as-read')
  async handleMarkAllAsRead(@ConnectedSocket() client: AuthenticatedSocket) {
    const userId = client.userId;
    if (!userId) return;

    const success = await this.notificationService.markAllAsRead(userId);

    if (success) {
      client.emit('unread-count', { count: 0 });
      client.emit('all-marked-as-read', {});
    }
  }

  /**
   * Get notifications via WebSocket
   */
  @UseGuards(WsAuthGuard)
  @SubscribeMessage('get-notifications')
  async handleGetNotifications(
    @MessageBody()
    data: { type?: NotificationType; read?: boolean; limit?: number },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const userId = client.userId;
    if (!userId) return;

    const result = await this.notificationService.getUserNotifications(
      userId,
      data,
    );
    client.emit('notifications-list', result);
  }

  /**
   * Send notification to specific user (called by service)
   */
  async sendNotificationToUser(
    userId: string,
    notification: any,
  ): Promise<void> {
    const userSocketIds = this.userSockets.get(userId);

    if (!userSocketIds || userSocketIds.size === 0) {
      this.logger.debug(`User ${userId} not connected, skipping WebSocket send`);
      return;
    }

    // Send to all user's connected sockets
    userSocketIds.forEach((socketId) => {
      this.server.to(socketId).emit('new-notification', notification);
    });

    // Also send updated unread count
    const unreadCount = await this.notificationService.getUnreadCount(userId);
    userSocketIds.forEach((socketId) => {
      this.server.to(socketId).emit('unread-count', { count: unreadCount });
    });

    this.logger.log(
      `Sent notification to user ${userId} (${userSocketIds.size} connections)`,
    );
  }

  /**
   * Broadcast to all connected users (for system-wide announcements)
   */
  async broadcastToAll(notification: any): Promise<void> {
    this.server.emit('system-notification', notification);
    this.logger.log(`Broadcasted notification to all users`);
  }

  /**
   * Verify JWT token and extract user ID
   * Uses proper signature verification with JwtService
   */
  private async verifyToken(token: string): Promise<string | null> {
    try {
      // ✅ Proper JWT signature verification
      const decoded = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
      
      // Extract user ID from token payload
      const userId = decoded?.sub || decoded?.userId || decoded?.id;
      
      if (!userId) {
        this.logger.warn('Token valid but no user ID found in payload');
        return null;
      }
      
      return userId;
    } catch (error) {
      this.logger.error('Token verification failed:', error.message);
      return null;
    }
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.userSockets.size;
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId);
  }
}
