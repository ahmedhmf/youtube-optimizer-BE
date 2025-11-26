import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SupabaseService } from '../supabase/supabase.service';

interface JwtUser {
  id: string;
  email: string;
  role?: string;
  [key: string]: any;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly supabaseService: SupabaseService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    // Validate token using Supabase Auth
    const client = this.supabaseService.getClient();
    const { data: { user }, error } = await client.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Get user profile from profiles table
    const { data: profile } = await client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Attach user to request
    request.user = {
      id: user.id,
      email: user.email ?? '',
      role: profile?.role ?? 'user',
      ...user.user_metadata,
    };

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
