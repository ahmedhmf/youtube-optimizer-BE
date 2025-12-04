import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { QueueUpdatePayload } from '../notifications/models/notification.types';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  namespace: 'queue',
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  },
})
export class QueueGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(QueueGateway.name);
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

  constructor(private readonly jwtService: JwtService) {}

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
        `Queue client connected: ${client.id} (User: ${userId}, Total connections: ${this.userSockets.get(userId)!.size})`,
      );
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
      this.logger.log(
        `Queue client disconnected: ${client.id} (User: ${userId})`,
      );
    }
  }

  /**
   * Subscribe to queue updates (client can request this)
   */
  @SubscribeMessage('subscribe-queue')
  async handleSubscribe(@ConnectedSocket() client: AuthenticatedSocket) {
    const userId = client.userId;
    if (!userId) return;

    this.logger.log(`User ${userId} subscribed to queue updates`);
    client.emit('subscribed', { success: true });
  }

  /**
   * Send queue update to specific user
   */
  sendQueueUpdateToUser(userId: string, queueUpdate: QueueUpdatePayload): void {
    const userSocketIds = this.userSockets.get(userId);

    if (!userSocketIds || userSocketIds.size === 0) {
      this.logger.debug(`User ${userId} not connected, skipping queue update`);
      return;
    }

    // Send to all user's connected sockets
    userSocketIds.forEach((socketId) => {
      this.server.to(socketId).emit('queue-update', queueUpdate);
    });

    this.logger.debug(
      `Sent queue update to user ${userId}: ${queueUpdate.eventType} (job: ${queueUpdate.jobId})`,
    );
  }

  /**
   * Verify JWT token and extract user ID
   */
  private async verifyToken(token: string): Promise<string | null> {
    try {
      const decoded = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      const userId = decoded?.sub || decoded?.userId || decoded?.id;

      if (!userId) {
        this.logger.warn('Token valid but no user ID found in payload');
        return null;
      }

      return userId;
    } catch (error) {
      this.logger.error(
        'Token verification failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
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
