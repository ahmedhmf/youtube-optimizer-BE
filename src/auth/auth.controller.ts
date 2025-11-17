import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SessionSecurityService } from './session-security.service';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { RequirePermissions } from './decorators/permissions.decorator';
import { UserRole } from './types/roles.types';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  UpdateProfileDto,
  SocialLoginRequestDto,
  SocialProvider,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto';
import { User } from './interfaces/user.interface';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionSecurityService: SessionSecurityService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 attempts per 5 minutes
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  async login(@Body() loginDto: LoginDto, @Req() req, @Res() res) {
    try {
      // Use enhanced session security login
      const result = await this.authService.loginWithSession(
        loginDto,
        req,
        res,
      );
      
      console.log('Login successful with session security for user:', result.user.email);
      return res.json(result);
    } catch (sessionError) {
      console.warn('Session security login failed, falling back to standard login:', sessionError);
      
      try {
        // Fallback to regular login if session creation fails
        const result = await this.authService.login(loginDto);
        
        console.log('Login successful (fallback) for user:', result.user.email);
        return res.json(result);
      } catch (error) {
        console.error('Login error:', error);
        throw error;
      }
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req, @Res() res) {
    try {
      // Use session security logout which cleans up sessions AND refresh tokens
      await this.sessionSecurityService.logout(req.user.id, undefined, res);
      return res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      // Fallback to regular logout if session security fails
      const result = await this.authService.logout(req.user.id);
      return res.json(result);
    }
  }

  @Post('refresh')
  async refresh(@Body() refreshDto: RefreshTokenDto) {
    return this.authService.refresh(refreshDto.refreshToken);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req): Promise<User> {
    return this.authService.getProfile(req.user.id);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Req() req,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<User> {
    return this.authService.updateProfile(req.user.id, updateProfileDto);
  }

  @Get('test')
  @UseGuards(JwtAuthGuard)
  testAuth(@Req() req: any) {
    return {
      message: 'JWT Auth working!',
      user: req.user,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('test/admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  testAdminOnly(@Req() req: any) {
    return {
      message: 'Admin access working!',
      user: req.user,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('test/premium')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('canUsePremiumFeatures')
  @Throttle({ default: { limit: 5, ttl: 300000 } }) // 5 premium feature accesses per 5 minutes
  testPremiumFeatures(@Req() req: any) {
    return {
      message: 'Premium features access working!',
      user: req.user,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('social/google')
  async googleLogin(@Body() body: SocialLoginRequestDto, @Req() req, @Res() res) {
    try {
      console.log('Google login request body:', body);

      if (!body.token) {
        throw new BadRequestException('Google token is required');
      }

      // Use enhanced session security login
      const result = await this.authService.socialLoginWithSession(
        {
          token: body.token,
          provider: SocialProvider.GOOGLE,
        },
        req,
        res,
      );

      console.log('Google login successful with session security for user:', result.user.email);
      return res.json(result);
    } catch (sessionError) {
      console.warn('Session security login failed, falling back to standard login:', sessionError);
      
      try {
        // Fallback to regular login if session creation fails
        const result = await this.authService.socialLogin({
          token: body.token,
          provider: SocialProvider.GOOGLE,
        });

        console.log('Google login successful (fallback) for user:', result.user.email);
        return res.json(result);
      } catch (error) {
        console.error('Google login error:', error);
        throw error;
      }
    }
  }

  @Post('social/github')
  async githubLogin(@Body() body: SocialLoginRequestDto) {
    console.log('GitHub login request body:', body);
    return await this.authService.socialLogin({
      code: body.code,
      provider: SocialProvider.GITHUB,
    });
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 2, ttl: 300000 } }) // 2 attempts per 5 minutes
  async requestPasswordReset(@Body() forgotPasswordDto: ForgotPasswordDto) {
    try {
      console.log('Password reset requested for:', forgotPasswordDto.email);
      const result =
        await this.authService.requestPasswordReset(forgotPasswordDto);
      return result;
    } catch (error) {
      console.error('Password reset request error:', error);
      throw error;
    }
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 attempts per 5 minutes
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    try {
      console.log('Password reset attempt with token');
      const result = await this.authService.resetPassword(resetPasswordDto);
      console.log('Password reset successful for token:', result);
      return result;
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  }

  // Session Management Endpoints

  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 attempts per minute
  async refreshToken(@Req() req, @Res() res) {
    try {
      const result = await this.sessionSecurityService.refreshSession(req, res);
      return res.json(result);
    } catch (error) {
      throw new BadRequestException('Failed to refresh token');
    }
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async getUserSessions(@Req() req) {
    const sessions = await this.sessionSecurityService.getUserSessions(
      req.user.id,
    );
    return { sessions };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  async logoutAllDevices(@Req() req, @Res() res) {
    await this.sessionSecurityService.revokeAllUserSessions(req.user.id);
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    return res.json({ message: 'Logged out from all devices' });
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @Req() req,
    @Res() res,
  ) {
    // TODO: Verify session belongs to user
    await this.sessionSecurityService.revokeSession(sessionId, res);
    return res.json({ message: 'Session revoked successfully' });
  }

  // Test endpoint for security events
  @Post('test-security-event')
  @UseGuards(JwtAuthGuard)
  async testSecurityEvent(@Req() req) {
    await this.sessionSecurityService.logSecurityEvent(
      req.user.id,
      'test_event',
      req.ip || 'unknown',
      req.headers['user-agent'] || 'unknown',
      undefined,
      {
        testData: 'This is a test security event',
        timestamp: new Date().toISOString(),
      },
    );
    return { message: 'Test security event logged' };
  }
}
