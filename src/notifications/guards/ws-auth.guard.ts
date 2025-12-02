import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  canActivate(context: ExecutionContext): boolean {
    try {
      const client = context.switchToWs().getClient();
      const userId = client.userId;

      if (!userId) {
        throw new WsException('Unauthorized');
      }

      return true;
    } catch (error) {
      this.logger.error('WebSocket auth error:', error);
      throw new WsException('Unauthorized');
    }
  }
}
