import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../supabase/supabase.service';
import express from 'express';
import { SessionData } from './types/session-data.type';
import { RefreshTokenData } from './types/resfresh-token-data';
import * as crypto from 'crypto';

@Injectable()
export class SessionSecurityService {
  private readonly logger = new Logger(SessionSecurityService.name);
  private readonly MAX_SESSIONS_PER_USER = 5;
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 30;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Get session details for audit trail
   */
  async getSessionDetails(sessionId: string): Promise<{
    deviceInfo: string;
    lastActivity: string;
  } | null> {
    try {
      const client = this.supabase.getServiceClient();

      const { data: session, error } = await client
        .from('user_sessions')
        .select('device_info, last_activity')
        .eq('session_id', sessionId)
        .single();

      if (error || !session) {
        return null;
      }

      return {
        deviceInfo: session.device_info,
        lastActivity: session.last_activity,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get session details: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Create secure session with refresh token stored in HTTP-only cookie
   */
  async createSecureSession(
    userId: string,
    email: string,
    role: string,
    request: express.Request,
    response: express.Response,
  ): Promise<{ accessToken: string; sessionId: string }> {
    // Use service role client to bypass RLS for session management
    const client = this.supabase.getServiceClient();

    // Generate device fingerprint
    const deviceId = this.generateDeviceId(request);
    const ipAddress = this.getClientIp(request);
    const userAgent: string =
      (request?.headers?.['user-agent'] as string) || 'unknown';

    // Check and cleanup old sessions for this user
    await this.cleanupUserSessions(userId);

    // Check if session already exists for this user-device combination
    const { data: existingSession } = await client
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .single<SessionData>();

    let session: SessionData;

    if (existingSession) {
      // Update existing session instead of creating new one
      this.logger.log(
        `Updating existing session for user ${userId}, device ${deviceId}`,
      );

      const { data: updatedSession, error: updateError } = await client
        .from('user_sessions')
        .update({
          email,
          role,
          ip_address: ipAddress,
          user_agent: userAgent,
          last_activity: new Date().toISOString(),
        })
        .eq('id', existingSession.id)
        .select()
        .single<SessionData>();

      if (updateError) {
        this.logger.error('Failed to update session:', updateError);
        throw new Error('Failed to update session');
      }

      session = updatedSession;
    } else {
      // Create new session record
      const sessionData: Partial<SessionData> = {
        user_id: userId,
        email,
        role,
        device_id: deviceId,
        ip_address: ipAddress,
        user_agent: userAgent,
        created_at: new Date(),
        last_activity: new Date(),
      };

      const { data: newSession, error: sessionError } = await client
        .from('user_sessions')
        .insert(sessionData)
        .select()
        .single<SessionData>();

      if (sessionError) {
        this.logger.error('Failed to create session:', sessionError);
        throw new Error('Failed to create session');
      }

      session = newSession;
    }

    const refreshToken = this.generateSecureToken();
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(
      refreshTokenExpiry.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS,
    );

    await client
      .from('refresh_tokens')
      .update({ is_revoked: true })
      .eq('user_id', userId)
      .eq('device_id', deviceId);

    const refreshTokenData: Partial<RefreshTokenData> = {
      token: refreshToken,
      user_id: userId,
      expires_at: refreshTokenExpiry,
      device_id: deviceId,
      is_revoked: false,
    };

    const { error: tokenError } = await client
      .from('refresh_tokens')
      .insert(refreshTokenData);

    if (tokenError) {
      this.logger.error('Failed to create refresh token:', tokenError);
      throw new Error('Failed to create refresh token');
    }

    // Set secure HTTP-only cookie for refresh token
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: this.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000, // 30 days
      path: '/auth/refresh',
    });

    // Generate short-lived access token (15 minutes)
    const accessToken = this.generateAccessToken({
      userId,
      email,
      role,
      sessionId: session.id,
    });

    this.logger.log(
      `Secure session created for user ${userId}, device ${deviceId}`,
    );

    // Log successful session creation event
    await this.logSecurityEvent(
      userId,
      'session_created',
      ipAddress,
      userAgent,
      deviceId,
      {
        sessionId: session.id,
        loginMethod: 'secure_session',
      },
    );

    return {
      accessToken,
      sessionId: session.id,
    };
  }

  /**
   * Validate and refresh session using HTTP-only cookie
   */
  async refreshSession(
    request: express.Request,
    response: any,
  ): Promise<{ accessToken: string } | null> {
    try {
      const refreshToken: string | undefined = request.cookies?.refreshToken as
        | string
        | undefined;

      if (!refreshToken || typeof refreshToken !== 'string') {
        return null;
      }

      const client = this.supabase.getServiceClient();

      // Step 1: Get refresh token data
      const { data: tokenData, error: tokenError } = await client
        .from('refresh_tokens')
        .select('*')
        .eq('token', refreshToken)
        .eq('is_revoked', false)
        .gt('expires_at', new Date().toISOString())
        .single<RefreshTokenData>();
      if (tokenError || !tokenData) {
        this.logger.warn('Invalid refresh token attempt');
        this.clearRefreshTokenCookie(response);
        return null;
      }

      // Step 2: Get corresponding session data using user_id and device_id
      const { data: sessionData, error: sessionError } = await client
        .from('user_sessions')
        .select('*')
        .eq('user_id', tokenData.user_id)
        .eq('device_id', tokenData.device_id)
        .single<SessionData>();

      if (sessionError || !sessionData) {
        this.logger.warn('No corresponding session found for refresh token');
        await this.revokeRefreshToken(refreshToken);
        this.clearRefreshTokenCookie(response);
        return null;
      }

      // Validate device fingerprint for additional security
      const currentDeviceId = this.generateDeviceId(request);
      if (tokenData.device_id && tokenData.device_id !== currentDeviceId) {
        this.logger.warn(
          `Device fingerprint mismatch for user ${tokenData.user_id}`,
        );
        await this.revokeRefreshToken(refreshToken);
        this.clearRefreshTokenCookie(response);
        return null;
      }

      // Update session activity
      await client
        .from('user_sessions')
        .update({
          last_activity: new Date().toISOString(),
          ip_address: this.getClientIp(request),
        })
        .eq('id', sessionData.id);

      // Generate new access token
      const accessToken = this.generateAccessToken({
        userId: tokenData.user_id,
        email: sessionData.email,
        role: sessionData.role,
        sessionId: sessionData.id,
      });

      // Log successful token refresh event
      await this.logSecurityEvent(
        tokenData.user_id,
        'token_refreshed',
        this.getClientIp(request),
        request.headers['user-agent'],
        tokenData.device_id,
        {
          sessionId: sessionData.id,
        },
      );

      return { accessToken };
    } catch (error) {
      this.logger.error('Error during session refresh:', error);
      return null;
    }
  }

  /**
   * Revoke session and clear cookies
   */
  async revokeSession(sessionId: string, response: any): Promise<void> {
    const client = this.supabase.getServiceClient();

    // Get session data to find associated refresh tokens
    const { data: session } = await client
      .from('user_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single();

    if (session) {
      // Revoke all refresh tokens for this session
      await client
        .from('refresh_tokens')
        .update({ is_revoked: true })
        .eq('user_id', session.user_id);
    }

    // Delete session
    await client.from('user_sessions').delete().eq('id', sessionId);

    // Clear refresh token cookie
    this.clearRefreshTokenCookie(response);

    // Log session revocation event
    if (session) {
      await this.logSecurityEvent(
        session.user_id,
        'session_revoked',
        undefined,
        undefined,
        undefined,
        {
          sessionId,
          reason: 'manual_revocation',
        },
      );
    }

    this.logger.log(`Session ${sessionId} revoked`);
  }

  /**
   * Revoke all sessions for a user (useful for logout all devices)
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    const client = this.supabase.getServiceClient();

    await client
      .from('refresh_tokens')
      .update({ is_revoked: true })
      .eq('user_id', userId);

    await client.from('user_sessions').delete().eq('user_id', userId);

    // Log logout from all devices event
    await this.logSecurityEvent(
      userId,
      'logout_all_devices',
      undefined,
      undefined,
      undefined,
      {
        reason: 'user_initiated',
      },
    );

    this.logger.log(`All sessions revoked for user ${userId}`);
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionData[]> {
    const client = this.supabase.getServiceClient();

    const { data: sessions, error } = await client
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('last_activity', { ascending: false })
      .returns<SessionData[]>();

    if (error) {
      this.logger.error('Failed to get user sessions:', error);
      return [];
    }

    return sessions ?? [];
  }

  private async cleanupUserSessions(userId: string): Promise<void> {
    const client = this.supabase.getServiceClient();

    // Get user's sessions ordered by last activity
    const { data: sessions } = await client
      .from('user_sessions')
      .select('id')
      .eq('user_id', userId)
      .order('last_activity', { ascending: false });

    if (!sessions || sessions.length <= this.MAX_SESSIONS_PER_USER) {
      return;
    }

    // Remove oldest sessions beyond the limit
    const sessionsToRemove = sessions.slice(this.MAX_SESSIONS_PER_USER);
    const sessionIds = sessionsToRemove.map((s: SessionData) => s.id);

    await client
      .from('refresh_tokens')
      .update({ is_revoked: true })
      .in('session_id', sessionIds);

    await client.from('user_sessions').delete().in('id', sessionIds);

    this.logger.log(
      `Cleaned up ${sessionsToRemove.length} old sessions for user ${userId}`,
    );
  }

  private async revokeRefreshToken(token: string): Promise<void> {
    const client = this.supabase.getServiceClient();
    await client
      .from('refresh_tokens')
      .update({ is_revoked: true })
      .eq('token', token);
  }

  private clearRefreshTokenCookie(response: express.Response): void {
    response.clearCookie('refreshToken', {
      httpOnly: true,
      path: '/auth/refresh',
    });
  }
  private generateDeviceId(request: express.Request): string {
    const userAgent = request.headers['user-agent'] || '';
    const acceptLanguage = request.headers['accept-language'] || '';
    const acceptEncoding = request.headers['accept-encoding'] || '';

    return crypto
      .createHash('sha256')
      .update(`${userAgent}${acceptLanguage}${acceptEncoding}`)
      .digest('hex')
      .substring(0, 16);
  }

  private getClientIp(request: express.Request): string {
    const xForwardedFor = request.headers['x-forwarded-for'];
    const xForwardedForIp = Array.isArray(xForwardedFor)
      ? xForwardedFor[0]
      : xForwardedFor?.split(',')[0];

    return (
      xForwardedForIp ||
      (request.headers['x-real-ip'] as string) ||
      request.connection?.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }

  private generateSecureToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  private generateAccessToken(payload: {
    userId: string;
    email: string;
    role: string;
    sessionId: string;
  }): string {
    return this.jwtService.sign({
      sub: payload.userId,
      email: payload.email,
      role: payload.role,
      sessionId: payload.sessionId,
    });
  }

  /**
   * Logout from current session (clean up session and refresh tokens)
   */
  async logout(
    userId: string,
    deviceId?: string,
    response?: any,
  ): Promise<void> {
    const client = this.supabase.getServiceClient();

    try {
      if (deviceId) {
        // Logout from specific device
        await client
          .from('refresh_tokens')
          .update({ is_revoked: true })
          .eq('user_id', userId)
          .eq('device_id', deviceId);

        await client
          .from('user_sessions')
          .delete()
          .eq('user_id', userId)
          .eq('device_id', deviceId);

        this.logger.log(`Logged out user ${userId} from device ${deviceId}`);
      } else {
        // Logout from all devices
        await client
          .from('refresh_tokens')
          .update({ is_revoked: true })
          .eq('user_id', userId);

        await client.from('user_sessions').delete().eq('user_id', userId);

        this.logger.log(`Logged out user ${userId} from all devices`);
      }

      // Clear refresh token cookie if response provided
      if (response) {
        this.clearRefreshTokenCookie(response);
      }

      // Log security event
      await this.logSecurityEvent(
        userId,
        deviceId ? 'logout_single_device' : 'logout_all_devices',
        undefined,
        undefined,
        deviceId,
        {
          reason: 'user_initiated',
          deviceId: deviceId || 'all',
        },
      );
    } catch (error) {
      this.logger.error('Error during logout:', error);
      throw error;
    }
  }

  /**
   * Log security events for audit trail
   */
  async logSecurityEvent(
    userId: string,
    eventType: string,
    ipAddress?: string,
    userAgent?: string,
    deviceId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const client = this.supabase.getServiceClient();

    try {
      const { error } = await client.from('security_events').insert({
        user_id: userId,
        event_type: eventType,
        ip_address: ipAddress,
        user_agent: userAgent,
        device_id: deviceId,
        metadata: metadata ?? {},
        created_at: new Date().toISOString(),
      });

      if (error) {
        this.logger.error('Failed to log security event:', error);
      } else {
        this.logger.debug(
          `Security event logged: ${eventType} for user ${userId}`,
        );
      }
    } catch (error) {
      this.logger.error('Error logging security event:', error);
    }
  }

  /**
   * Cleanup expired sessions and tokens (run daily)
   */
  async cleanupExpiredSessions(): Promise<void> {
    const client = this.supabase.getServiceClient();
    const now = new Date().toISOString();

    // Remove expired refresh tokens
    await client.from('refresh_tokens').delete().lt('expires_at', now);

    // Remove sessions inactive for more than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await client
      .from('user_sessions')
      .delete()
      .lt('last_activity', thirtyDaysAgo.toISOString());

    this.logger.log('Expired sessions and tokens cleaned up');
  }
}
