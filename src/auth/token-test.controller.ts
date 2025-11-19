import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenBlacklistService, BlacklistReason } from './token-blacklist.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

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
      const isBlacklisted = await this.tokenBlacklistService.isTokenBlacklisted(token);
      
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

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}