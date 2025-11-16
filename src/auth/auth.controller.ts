import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
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
} from './dto';
import { User } from './interfaces/user.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req) {
    return this.authService.logout(req.user.id);
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
  testPremiumFeatures(@Req() req: any) {
    return {
      message: 'Premium features access working!',
      user: req.user,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('social/google')
  async googleLogin(@Body() body: SocialLoginRequestDto) {
    try {
      console.log('Google login request body:', body);
      
      if (!body.token) {
        throw new BadRequestException('Google token is required');
      }

      const result = await this.authService.socialLogin({
        token: body.token,
        provider: SocialProvider.GOOGLE,
      });

      console.log('Google login successful for user:', result.user.email);
      return result;
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
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
}
