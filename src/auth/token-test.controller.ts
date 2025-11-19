import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  TokenBlacklistService,
  BlacklistReason,
} from './token-blacklist.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

@ApiTags('Token Testing')
@Controller('test-token')
export class TokenTestController {
  constructor(private readonly tokenBlacklistService: TokenBlacklistService) {}

  @Post('blacklist')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test token blacklisting' })
  async testBlacklistToken(@Req() req: any) {
    const token = this.extractTokenFromHeader(req);
    const userId = req.user?.id;

    if (!token || !userId) {
      return { error: 'Missing token or user ID' };
    }

    try {
      await this.tokenBlacklistService.blacklistToken(
        token,
        userId,
        BlacklistReason.ADMIN_REVOKE,
      );

      return {
        success: true,
        message: 'Token blacklisted successfully',
        userId,
        tokenLength: token.length,
      };
    } catch (error) {
      return {
        error: 'Failed to blacklist token',
        details: error.message,
        userId,
      };
    }
  }

  @Get('check')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if current token is blacklisted' })
  async checkTokenBlacklist(@Req() req: any) {
    const token = this.extractTokenFromHeader(req);
    const userId = req.user?.id;

    if (!token || !userId) {
      return { error: 'Missing token or user ID' };
    }

    try {
      const isBlacklisted =
        await this.tokenBlacklistService.isTokenBlacklisted(token);

      return {
        isBlacklisted,
        userId,
        tokenLength: token.length,
      };
    } catch (error) {
      return {
        error: 'Failed to check token blacklist',
        details: error.message,
        userId,
      };
    }
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get blacklist statistics' })
  async getBlacklistStats() {
    try {
      const stats = await this.tokenBlacklistService.getBlacklistStats();
      return stats;
    } catch (error) {
      return {
        error: 'Failed to get blacklist stats',
        details: error.message,
      };
    }
  }

  @Get('debug-token')
  @ApiOperation({ summary: 'Debug token validation without guards' })
  async debugToken(@Req() req: any) {
    const token = this.extractTokenFromHeader(req);

    if (!token) {
      return { error: 'No token provided' };
    }

    try {
      // Try to decode the token without validation
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        return { error: 'Invalid token format' };
      }

      const payload = JSON.parse(
        Buffer.from(tokenParts[1], 'base64').toString(),
      );

      return {
        success: true,
        tokenProvided: !!token,
        tokenLength: token.length,
        payload: payload,
        isExpired: payload.exp ? Date.now() / 1000 > payload.exp : false,
      };
    } catch (error) {
      return {
        error: 'Failed to decode token',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  @Post('test-blacklist-direct')
  @ApiOperation({ summary: 'Test blacklisting without auth guards' })
  async testBlacklistDirect(@Body() body: { token: string; userId: string }) {
    console.log('Direct blacklist test called:', {
      hasToken: !!body.token,
      hasUserId: !!body.userId,
    });

    if (!body.token || !body.userId) {
      return { error: 'Token and userId are required' };
    }

    try {
      console.log('Attempting to blacklist token directly...');
      await this.tokenBlacklistService.blacklistToken(
        body.token,
        body.userId,
        BlacklistReason.ADMIN_REVOKE,
      );

      console.log('Direct blacklist successful');
      return {
        success: true,
        message: 'Token blacklisted successfully via direct test',
      };
    } catch (error) {
      console.error('Direct blacklist failed:', error);
      return {
        error: 'Failed to blacklist token',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
