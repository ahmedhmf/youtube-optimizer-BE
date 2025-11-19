import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

interface JwtUser {
  id: string;
  email: string;
  [key: string]: any;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = JwtUser>(err: any, user: any): TUser {
    if (err || !user) {
      throw err || new Error('Unauthorized');
    }
    return user as TUser;
  }
}
