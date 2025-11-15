import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
    console.log('JWT Strategy Constructor - JWT_SECRET:', jwtSecret ? 'SET' : 'NOT SET');
    console.log('JWT Strategy - Using secret:', jwtSecret.substring(0, 10) + '...');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
    console.log('JWT Strategy initialized successfully');
  }

  async validate(payload: any) {
    console.log('JWT Strategy - validating payload:', payload);
    try {
      const user = await this.authService.validateUser(payload.sub);
      if (!user) {
        console.log('JWT Strategy - user not found for ID:', payload.sub);
        throw new UnauthorizedException('User not found');
      }
      console.log('JWT Strategy - validation successful for user:', user.id);
      return user;
    } catch (error) {
      console.log('JWT Strategy - validation error:', error.message);
      throw new UnauthorizedException(error.message);
    }
  }
}