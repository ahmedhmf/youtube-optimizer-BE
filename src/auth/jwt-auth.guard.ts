import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TokenBlacklistService } from './token-blacklist.service';

interface JwtUser {
  id: string;
  email: string;
  iat?: number;
  [key: string]: any;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly tokenBlacklistService: TokenBlacklistService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First, let the JWT strategy validate the token
    const result = await super.canActivate(context);

    if (!result) {
      return false;
    }

    // Extract token from request
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    // Check if token is blacklisted
    const isBlacklisted =
      await this.tokenBlacklistService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // Check if user's token version is still valid (for bulk invalidation)
    const user = request.user as JwtUser;
    if (user?.id && user?.iat) {
      const isVersionValid =
        await this.tokenBlacklistService.isUserTokenVersionValid(
          user.id,
          user.iat,
        );
      if (!isVersionValid) {
        throw new UnauthorizedException('Token has been invalidated');
      }
    }

    return true;
  }

  handleRequest<TUser = JwtUser>(err: any, user: any): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid token');
    }
    return user as TUser;
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
