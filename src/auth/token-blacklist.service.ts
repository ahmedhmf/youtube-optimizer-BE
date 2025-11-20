import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

export interface BlacklistedToken {
  id: string;
  token_hash: string;
  user_id: string;
  expires_at: Date;
  reason: string;
  created_at: Date;
}

export enum BlacklistReason {
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  ADMIN_REVOKE = 'admin_revoke',
  ACCOUNT_DISABLED = 'account_disabled',
  SECURITY_BREACH = 'security_breach',
}
@Injectable()
export class TokenBlacklistService implements OnModuleInit {
  private readonly tokenCache = new Map<string, boolean>();
  private readonly cacheExpiry = new Map<string, number>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    // Start cleanup job for expired tokens
    this.startCleanupJob();

    // Load recently blacklisted tokens into cache
    await this.loadRecentTokensToCache();
  }

  /**
   * Blacklist a specific token
   */
  async blacklistToken(
    token: string,
    userId: string,
    reason: BlacklistReason = BlacklistReason.LOGOUT,
  ): Promise<void> {
    console.log('TokenBlacklistService.blacklistToken called:', {
      userId,
      reason,
      tokenLength: token.length,
    });

    try {
      // Extract expiration from token
      const decoded = this.jwtService.decode(token);
      console.log('Token decoded:', {
        hasDecoded: !!decoded,
        type: typeof decoded,
      });

      if (!decoded || typeof decoded !== 'object' || !decoded.exp) {
        throw new Error('Invalid token: missing expiration');
      }

      const expiresAt = new Date(decoded.exp * 1000);
      console.log('Token expiration:', expiresAt.toISOString());

      // Create hash of token for storage (security best practice)
      const tokenHash = this.hashToken(token);
      console.log('Token hash created, length:', tokenHash.length);

      const { error } = await this.supabaseService
        .getServiceClient()
        .from('blacklisted_tokens')
        .insert({
          token_hash: tokenHash,
          user_id: userId,
          expires_at: expiresAt.toISOString(),
          reason,
        });

      if (error) {
        console.error('Database error blacklisting token:', error);
        throw new Error(`Failed to blacklist token: ${error.message}`);
      }

      console.log('Token inserted into database successfully');

      // Add to cache
      this.tokenCache.set(tokenHash, true);
      this.cacheExpiry.set(tokenHash, expiresAt.getTime());

      console.log(
        `Token blacklisted successfully for user ${userId}, reason: ${reason}`,
      );
    } catch (error) {
      console.error('Error in blacklistToken:', error);
      throw error;
    }
  }

  /**
   * Blacklist all tokens for a user
   */
  async blacklistAllUserTokens(
    userId: string,
    reason: BlacklistReason = BlacklistReason.PASSWORD_CHANGE,
  ): Promise<void> {
    try {
      // Get user's token version or timestamp for bulk invalidation
      const tokenVersion = await this.getUserTokenVersion(userId);

      // Update user's token version to invalidate all existing tokens
      const { error } = await this.supabaseService
        .getServiceClient()
        .from('user_profiles')
        .update({
          token_version: tokenVersion + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.error('Error updating user token version:', error);
        throw new Error('Failed to blacklist user tokens');
      }

      // Clear user's tokens from cache
      this.clearUserTokensFromCache(userId);

      console.log(
        `All tokens blacklisted for user ${userId}, reason: ${reason}`,
      );
    } catch (error) {
      console.error('Error in blacklistAllUserTokens:', error);
      throw error;
    }
  }

  /**
   * Check if a token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const tokenHash = this.hashToken(token);

      // First check cache
      if (this.tokenCache.has(tokenHash)) {
        const expiryTime = this.cacheExpiry.get(tokenHash);
        if (expiryTime && expiryTime > Date.now()) {
          return true;
        } else {
          // Token expired, remove from cache
          this.tokenCache.delete(tokenHash);
          this.cacheExpiry.delete(tokenHash);
        }
      }

      // Check database if not in cache
      const { data, error } = await this.supabaseService
        .getServiceClient()
        .from('blacklisted_tokens')
        .select('expires_at')
        .eq('token_hash', tokenHash)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking blacklisted token:', error);
        return false; // Fail open for availability
      }

      if (data) {
        const expiresAt = new Date(data.expires_at);
        if (expiresAt > new Date()) {
          // Add to cache for faster future lookups
          this.tokenCache.set(tokenHash, true);
          this.cacheExpiry.set(tokenHash, expiresAt.getTime());
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error in isTokenBlacklisted:', error);
      return false; // Fail open for availability
    }
  }

  /**
   * Check if user's tokens are invalidated via token version
   */
  async isUserTokenVersionValid(
    userId: string,
    tokenIssuedAt: number,
  ): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseService
        .getServiceClient()
        .from('user_profiles')
        .select('token_version, updated_at')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return true; // Fail open if user not found
      }

      // If token was issued before user's token version was updated, it's invalid
      const userUpdatedAt = new Date(data.updated_at).getTime() / 1000;
      return tokenIssuedAt >= userUpdatedAt;
    } catch (error) {
      console.error('Error checking user token version:', error);
      return true; // Fail open for availability
    }
  }

  /**
   * Get blacklisted tokens for a user (admin function)
   */
  async getUserBlacklistedTokens(userId: string): Promise<BlacklistedToken[]> {
    try {
      const { data, error } = await this.supabaseService
        .getServiceClient()
        .from('blacklisted_tokens')
        .select('*')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user blacklisted tokens:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserBlacklistedTokens:', error);
      return [];
    }
  }

  /**
   * Clean up expired blacklisted tokens
   */
  async cleanupExpiredTokens(): Promise<void> {
    try {
      const { error } = await this.supabaseService
        .getServiceClient()
        .from('blacklisted_tokens')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) {
        console.error('Error cleaning up expired tokens:', error);
      } else {
        console.log('Cleaned up expired blacklisted tokens');
      }

      // Clean up cache
      this.cleanupExpiredCacheEntries();
    } catch (error) {
      console.error('Error in cleanupExpiredTokens:', error);
    }
  }

  /**
   * Get blacklist statistics (admin function)
   */
  async getBlacklistStats(): Promise<{
    totalBlacklisted: number;
    byReason: Record<string, number>;
    recentActivity: number;
  }> {
    try {
      const { data, error } = await this.supabaseService
        .getServiceClient()
        .from('blacklisted_tokens')
        .select('reason, created_at')
        .gt('expires_at', new Date().toISOString());

      if (error) {
        console.error('Error fetching blacklist stats:', error);
        return { totalBlacklisted: 0, byReason: {}, recentActivity: 0 };
      }

      const stats = {
        totalBlacklisted: data?.length || 0,
        byReason: {} as Record<string, number>,
        recentActivity: 0,
      };

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      data?.forEach((token) => {
        // Count by reason
        stats.byReason[token.reason] = (stats.byReason[token.reason] || 0) + 1;

        // Count recent activity (last 24 hours)
        if (new Date(token.created_at) > oneDayAgo) {
          stats.recentActivity++;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error in getBlacklistStats:', error);
      return { totalBlacklisted: 0, byReason: {}, recentActivity: 0 };
    }
  }
  private hashToken(token: string): string {
    // Use built-in crypto for token hashing
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async getUserTokenVersion(userId: string): Promise<number> {
    try {
      const { data, error } = await this.supabaseService
        .getServiceClient()
        .from('user_profiles')
        .select('token_version')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return 0;
      }

      return typeof data.token_version === 'number' ? data.token_version : 0;
    } catch (error) {
      console.error('Error getting user token version:', error);
      return 0;
    }
  }

  private clearUserTokensFromCache(userId: string): void {
    // Note: This is a simple implementation.
    // In a production system, you might want to store user ID with token hash
    // for more efficient cache invalidation
    this.tokenCache.clear();
    this.cacheExpiry.clear();
  }

  private async loadRecentTokensToCache(): Promise<void> {
    try {
      // Load tokens from the last hour into cache for performance
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const { data, error } = await this.supabaseService
        .getServiceClient()
        .from('blacklisted_tokens')
        .select('token_hash, expires_at')
        .gt('expires_at', new Date().toISOString())
        .gt('created_at', oneHourAgo.toISOString());

      if (error) {
        console.error('Error loading tokens to cache:', error);
        return;
      }

      data?.forEach((token) => {
        this.tokenCache.set(token.token_hash, true);
        this.cacheExpiry.set(
          token.token_hash,
          new Date(token.expires_at).getTime(),
        );
      });

      console.log(`Loaded ${data?.length || 0} recent tokens to cache`);
    } catch (error) {
      console.error('Error in loadRecentTokensToCache:', error);
    }
  }

  private startCleanupJob(): void {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredTokens().catch((error) => {
          console.error('Error in cleanup job:', error);
        });
      },
      60 * 60 * 1000,
    );
  }

  private cleanupExpiredCacheEntries(): void {
    const now = Date.now();
    for (const [tokenHash, expiryTime] of this.cacheExpiry.entries()) {
      if (expiryTime <= now) {
        this.tokenCache.delete(tokenHash);
        this.cacheExpiry.delete(tokenHash);
      }
    }
  }

  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
