import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    console.log('JwtAuthGuard - canActivate called');
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    console.log('JwtAuthGuard - Authorization header:', authHeader ? 'Present' : 'Missing');
    if (authHeader) {
      console.log('JwtAuthGuard - Token preview:', authHeader.substring(0, 50) + '...');
    }
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    console.log('JwtAuthGuard - handleRequest called');
    console.log('JwtAuthGuard - Error:', err);
    console.log('JwtAuthGuard - User:', user ? 'Found' : 'Not found');
    console.log('JwtAuthGuard - Info:', info);
    
    if (err || !user) {
      console.log('JwtAuthGuard - Throwing UnauthorizedException');
      throw err || new Error('Unauthorized');
    }
    return user;
  }
}