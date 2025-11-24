import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import express from 'express';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../supabase/supabase.service';
import { LogAggregatorService } from '../logging/services/log-aggregator.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import {
  LoginDto,
  RegisterDto,
  SocialLoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto';
import { UserRole } from './types/roles.types';
import { SocialAuthService } from './social-auth.service';
import { SocialProvider, SocialUserInfo } from './dto/social-login.dto';
import { AccountLockoutService } from './account-lockout.service';
import { SessionSecurityService } from './session-security.service';
import {
  TokenBlacklistService,
  BlacklistReason,
} from './token-blacklist.service';
import { User } from './types/user.interface';
import { Profile } from './types/profiles.type';
import { AuthResponse } from './types/auth-response.type';
import { RefreshTokens } from './types/refresh-token.type';
import { SocialRegistration } from './types/social-registeration.type';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly socialAuthService: SocialAuthService,
    private readonly accountLockoutService: AccountLockoutService,
    private readonly sessionSecurityService: SessionSecurityService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly logAggregatorService: LogAggregatorService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, name } = registerDto;
    const client = this.supabase.getClient();
    const { data: existingUser, error: checkError } = await client
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single<Profile>();

    if (checkError && checkError.code !== 'PGRST116') {
      throw new BadRequestException(`Database error: ${checkError.message}`);
    }

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate a UUID for the new user
    const userId = crypto.randomUUID();

    // Create user profile
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .insert({
        id: userId,
        email,
        name: name || email.split('@')[0],
        password_hash: hashedPassword,
        role: UserRole.USER, // Default role for new users
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single<Profile>();

    if (profileError) {
      throw new BadRequestException(
        `Profile creation failed: ${profileError.message}`,
      );
    }

    const user: User = {
      id: profile.id,
      email: profile.email,
      name: profile.name ?? '',
      role: this.getUserRoleFromString(profile.role),
      picture: profile.picture ?? '',
      provider: this.getValidProvider(profile.provider),
      createdAt: new Date(profile.created_at ?? ''),
      updatedAt: new Date(profile.updated_at ?? ''),
    };

    const tokens = await this.generateTokens(user.id);

    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user,
      expiresIn: this.getJwtExpirationTime(),
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;
    const client = this.supabase.getClient();

    // Check if account is locked
    const lockoutStatus =
      await this.accountLockoutService.checkLockoutStatus(email);
    if (lockoutStatus.isLocked) {
      throw new UnauthorizedException(
        `Account temporarily locked. Try again after ${lockoutStatus.lockoutUntil?.toLocaleString()}. Too many failed login attempts.`,
      );
    }

    // Get user by email
    const { data: profile, error } = await client
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single<Profile>();

    if (error || !profile) {
      // Record failed attempt for invalid email
      await this.accountLockoutService.recordFailedAttempt(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!profile.password_hash) {
      // Record failed attempt for missing password hash
      await this.accountLockoutService.recordFailedAttempt(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      profile.password_hash,
    );
    if (!isPasswordValid) {
      // Record failed attempt for invalid password
      const lockoutResult =
        await this.accountLockoutService.recordFailedAttempt(email);

      let errorMessage = 'Invalid credentials';
      if (lockoutResult.isLocked) {
        errorMessage = `Account locked after ${lockoutResult.totalFailedAttempts} failed attempts. Try again after ${lockoutResult.lockoutUntil?.toLocaleString()}.`;
      } else if (lockoutResult.remainingAttempts <= 2) {
        errorMessage = `Invalid credentials. ${lockoutResult.remainingAttempts} attempts remaining before account lockout.`;
      }

      throw new UnauthorizedException(errorMessage);
    }

    const user: User = {
      id: profile.id,
      email: profile.email,
      name: profile.name ?? '',
      role: this.getUserRoleFromString(profile.role),
      picture: profile.picture ?? '',
      provider: this.getValidProvider(profile.provider),
      createdAt: new Date(profile.created_at ?? ''),
      updatedAt: new Date(profile.updated_at ?? ''),
    };

    // Successful login - reset any lockout
    await this.accountLockoutService.resetLockout(email);

    const tokens = await this.generateTokens(user.id);

    // Store refresh token
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    // Update last login
    await client
      .from('profiles')
      .update({
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    return {
      ...tokens,
      user,
      expiresIn: this.getJwtExpirationTime(),
    };
  }

  /**
   * Enhanced login with session security (when request/response objects are available)
   */
  async loginWithSession(
    loginDto: LoginDto,
    request: express.Request,
    response: express.Response,
  ): Promise<AuthResponse> {
    // First do the standard login to get/validate user
    const standardResult = await this.login(loginDto);

    // Now create secure session instead of returning JWT tokens
    const sessionData = await this.sessionSecurityService.createSecureSession(
      standardResult.user.id,
      standardResult.user.email,
      standardResult.user.role,
      request,
      response,
    );

    const jwtExpiresIn = this.getJwtExpirationTime();

    // Return access token only (refresh token is in HTTP-only cookie)
    return {
      accessToken: sessionData.accessToken,
      refreshToken: '', // Empty since it's in HTTP-only cookie
      user: standardResult.user,
      expiresIn: jwtExpiresIn,
    };
  }

  async logout(userId: string, token?: string): Promise<{ success: boolean }> {
    try {
      if (token) {
        await this.tokenBlacklistService.blacklistToken(
          token,
          userId,
          BlacklistReason.LOGOUT,
        );
      }

      // Use session security service for proper cleanup
      await this.sessionSecurityService.logout(userId);

      return { success: true };
    } catch (error) {
      if (
        token &&
        !(error instanceof Error ? error.message?.includes('blacklist') : false)
      ) {
        try {
          await this.tokenBlacklistService.blacklistToken(
            token,
            userId,
            BlacklistReason.LOGOUT,
          );
        } catch (blacklistError) {
          console.error('Fallback token blacklisting failed:', blacklistError);
        }
      }

      // Fallback cleanup
      const client = this.supabase.getClient();
      await client.from('refresh_tokens').delete().eq('user_id', userId);
      return { success: true };
    }
  }

  async refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  }> {
    const client = this.supabase.getClient();

    // Validate refresh token
    const { data: tokenData, error } = await client
      .from('refresh_tokens')
      .select('user_id, expires_at')
      .eq('token', refreshToken)
      .single<RefreshTokens>();

    if (error || !tokenData) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      // Clean up expired token
      await client.from('refresh_tokens').delete().eq('token', refreshToken);

      throw new UnauthorizedException('Refresh token expired');
    }

    // Generate new access token
    const accessToken = this.jwtService.sign({ sub: tokenData.user_id });

    // Optionally generate new refresh token (rotate refresh tokens)
    const shouldRotateRefreshToken = true;
    let newRefreshToken: string | undefined;

    if (shouldRotateRefreshToken) {
      // Delete old refresh token
      await client.from('refresh_tokens').delete().eq('token', refreshToken);

      // Generate new refresh token
      newRefreshToken = this.generateRefreshToken();
      await this.storeRefreshToken(tokenData.user_id, newRefreshToken);
    }

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.getJwtExpirationTime(),
    };
  }

  async getProfile(userId: string): Promise<User> {
    const client = this.supabase.getClient();
    const { data: profile, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single<Profile>();

    if (error) {
      throw new UnauthorizedException(`Database error: ${error.message}`);
    }

    if (!profile) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: profile.id,
      email: profile.email,
      name: profile.name ?? '',
      role: this.getUserRoleFromString(profile.role),
      picture: profile.picture ?? '',
      provider: this.getValidProvider(profile.provider),
      createdAt: new Date(profile.created_at ?? ''),
      updatedAt: new Date(profile.updated_at ?? ''),
    };
  }

  async updateProfile(
    userId: string,
    updates: Partial<User>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<User> {
    const client = this.supabase.getClient();

    // Get old profile data for audit trail
    const { data: oldProfile } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single<Profile>();

    const allowedUpdates = ['name'];
    const filteredUpdates: any = {};
    const oldValues: any = {};
    const newValues: any = {};
    const changes: string[] = [];

    Object.keys(updates).forEach((key: keyof User) => {
      if (allowedUpdates.includes(key)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        filteredUpdates[key] = updates[key];
        if (oldProfile && oldProfile[key] !== updates[key]) {
          oldValues[key] = oldProfile[key];
          newValues[key] = updates[key];
          changes.push(key);
        }
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    filteredUpdates.updated_at = new Date().toISOString();

    const { data: profile, error } = await client
      .from('profiles')
      .update(filteredUpdates)
      .eq('id', userId)
      .select()
      .single<Profile>();

    if (error || !profile) {
      throw new BadRequestException('Failed to update profile');
    }

    // Log audit trail if there are changes
    if (changes.length > 0) {
      await this.logAggregatorService.logAuditTrail({
        actorId: userId,
        actorEmail: profile.email,
        actorRole: profile.role || 'user',
        action: 'update_own_profile',
        entityType: 'user_profile',
        entityId: userId,
        oldValues,
        newValues,
        changes,
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        metadata: {
          selfService: true,
          updatedAt: new Date().toISOString(),
        },
      });
    }

    return {
      id: profile.id,
      email: profile.email,
      name: profile.name ?? '',
      role: this.getUserRoleFromString(profile.role),
      picture: profile.picture ?? '',
      provider: this.getValidProvider(profile.provider),
      createdAt: new Date(profile.created_at ?? ''),
      updatedAt: new Date(profile.updated_at ?? ''),
    };
  }

  async validateUser(userId: string): Promise<User | null> {
    try {
      const user = await this.getProfile(userId);
      return user;
    } catch {
      return null;
    }
  }

  private async generateTokens(userId: string) {
    // Get user profile to include role in token
    const user = await this.getProfile(userId);
    const accessToken = this.jwtService.sign({
      sub: userId,
      role: user.role,
    });
    const refreshToken = this.generateRefreshToken();

    return {
      accessToken,
      refreshToken,
    };
  }

  private generateRefreshToken(): string {
    const token = this.jwtService.sign(
      { type: 'refresh', random: Math.random() },
      { expiresIn: '7d' },
    );
    return token;
  }

  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const client = this.supabase.getClient();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await client.from('refresh_tokens').insert({
      user_id: userId,
      token: refreshToken,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    });
  }

  async socialLogin(socialLoginDto: SocialLoginDto): Promise<AuthResponse> {
    let socialUserInfo: SocialUserInfo;
    // Validate social provider token/code
    if (socialLoginDto.provider === SocialProvider.GOOGLE) {
      if (!socialLoginDto.token) {
        throw new BadRequestException('Google token is required');
      }
      socialUserInfo = await this.socialAuthService.validateGoogleToken(
        socialLoginDto.token,
      );
    } else {
      throw new BadRequestException('Unsupported social provider');
    }

    const client = this.supabase.getClient();
    const { data: existingUser } = await client
      .from('profiles')
      .select('*')
      .eq('email', socialUserInfo.email)
      .single<Profile>();

    let user: User;

    if (existingUser) {
      const updateData: SocialRegistration = {
        name: existingUser.name || socialUserInfo.name,
        picture: socialUserInfo.picture,
        updated_at: new Date().toISOString(),
      };

      if (existingUser.provider === 'email' || !existingUser.password_hash) {
        updateData.provider = socialUserInfo.provider;
      }

      const { data: updatedProfile, error: updateError } = await client
        .from('profiles')
        .update(updateData)
        .eq('id', existingUser.id)
        .select()
        .single<Profile>();

      if (updateError) {
        throw new BadRequestException(
          `Failed to update user profile: ${updateError.message}`,
        );
      }

      user = {
        id: updatedProfile.id,
        email: updatedProfile.email,
        name: updatedProfile.name ?? socialUserInfo.name,
        role: this.getUserRoleFromString(updatedProfile.role),
        picture: updatedProfile.picture ?? socialUserInfo.picture,
        provider: this.getValidProvider(updatedProfile.provider),
        createdAt: new Date(updatedProfile.created_at ?? ''),
        updatedAt: new Date(updatedProfile.updated_at ?? ''),
      };
    } else {
      const userId = crypto.randomUUID();
      const placeholderPasswordHash = await bcrypt.hash(
        `social-login-${userId}-${Date.now()}`,
        12,
      );

      const { data: newProfile, error: createError } = await client
        .from('profiles')
        .insert({
          id: userId,
          email: socialUserInfo.email,
          name: socialUserInfo.name,
          role: UserRole.USER,
          picture: socialUserInfo.picture,
          provider: socialUserInfo.provider,
          password_hash: placeholderPasswordHash, // Required by database, but won't be used
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single<Profile>();

      if (createError) {
        throw new BadRequestException(
          `Failed to create user profile: ${createError.message}`,
        );
      }

      user = {
        id: newProfile.id,
        email: newProfile.email,
        name: newProfile.name ?? socialUserInfo.name,
        role: this.getUserRoleFromString(newProfile.role),
        picture: newProfile.picture ?? socialUserInfo.picture,
        provider: this.getValidProvider(newProfile.provider),
        createdAt: new Date(newProfile.created_at ?? ''),
        updatedAt: new Date(newProfile.updated_at ?? ''),
      };
    }

    const tokens = await this.generateTokens(user.id);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user,
      expiresIn: this.getJwtExpirationTime(),
    };
  }

  /**
   * Handle Google OAuth callback - exchange code for user info and create session
   */
  async handleGoogleCallback(
    code: string,
    req: express.Request,
    res: express.Response,
  ): Promise<AuthResponse> {
    // Exchange authorization code for user info
    const socialUserInfo =
      await this.socialAuthService.exchangeGoogleCode(code);

    const client = this.supabase.getClient();
    const { data: existingUser } = await client
      .from('profiles')
      .select('*')
      .eq('email', socialUserInfo.email)
      .single<Profile>();

    let user: User;

    if (existingUser) {
      // Update existing user
      const updateData: SocialRegistration = {
        name: existingUser.name || socialUserInfo.name,
        picture: socialUserInfo.picture,
        updated_at: new Date().toISOString(),
      };

      if (existingUser.provider === 'email' || !existingUser.password_hash) {
        updateData.provider = socialUserInfo.provider;
      }

      const { data: updatedProfile, error: updateError } = await client
        .from('profiles')
        .update(updateData)
        .eq('id', existingUser.id)
        .select()
        .single<Profile>();

      if (updateError) {
        throw new BadRequestException(
          `Failed to update user profile: ${updateError.message}`,
        );
      }

      user = {
        id: updatedProfile.id,
        email: updatedProfile.email,
        name: updatedProfile.name ?? socialUserInfo.name,
        role: this.getUserRoleFromString(updatedProfile.role),
        picture: updatedProfile.picture ?? socialUserInfo.picture,
        provider: this.getValidProvider(updatedProfile.provider),
        createdAt: new Date(updatedProfile.created_at ?? ''),
        updatedAt: new Date(updatedProfile.updated_at ?? ''),
      };
    } else {
      // Create new user
      const userId = crypto.randomUUID();
      const placeholderPasswordHash = await bcrypt.hash(
        `social-login-${userId}-${Date.now()}`,
        12,
      );

      const { data: newProfile, error: createError } = await client
        .from('profiles')
        .insert({
          id: userId,
          email: socialUserInfo.email,
          name: socialUserInfo.name,
          role: UserRole.USER,
          picture: socialUserInfo.picture,
          provider: socialUserInfo.provider,
          password_hash: placeholderPasswordHash,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single<Profile>();

      if (createError) {
        throw new BadRequestException(
          `Failed to create user profile: ${createError.message}`,
        );
      }

      user = {
        id: newProfile.id,
        email: newProfile.email,
        name: newProfile.name ?? socialUserInfo.name,
        role: this.getUserRoleFromString(newProfile.role),
        picture: newProfile.picture ?? socialUserInfo.picture,
        provider: this.getValidProvider(newProfile.provider),
        createdAt: new Date(newProfile.created_at ?? ''),
        updatedAt: new Date(newProfile.updated_at ?? ''),
      };
    }

    // Create secure session with session security service
    const sessionData = await this.sessionSecurityService.createSecureSession(
      user.id,
      user.email,
      user.role,
      req,
      res,
    );

    return {
      accessToken: sessionData.accessToken,
      refreshToken: '', // Empty since it's in HTTP-only cookie
      user,
      expiresIn: this.getJwtExpirationTime(),
    };
  }

  async socialLoginWithSession(
    socialLoginDto: SocialLoginDto,
    request: any,
    response: any,
  ): Promise<AuthResponse> {
    const standardResult = await this.socialLogin(socialLoginDto);

    const sessionData = await this.sessionSecurityService.createSecureSession(
      standardResult.user.id,
      standardResult.user.email,
      standardResult.user.role,
      request,
      response,
    );

    // Return access token only (refresh token is in HTTP-only cookie)
    return {
      accessToken: sessionData.accessToken,
      refreshToken: '', // Empty since it's in HTTP-only cookie
      user: standardResult.user,
      expiresIn: this.getJwtExpirationTime(),
    };
  }

  /**
   * Request password reset for a user using Supabase Auth
   * @param forgotPasswordDto Contains the user's email
   * @returns Success message
   */
  async requestPasswordReset(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const { email } = forgotPasswordDto;
    const client = this.supabase.getClient();

    // const { data: profile, error: profileError } = await client
    //   .from('profiles')
    //   .select('id, email')
    //   .eq('email', email)
    //   .single();

    // Use Supabase Auth to send password reset email
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:4200'}/reset-password`,
    });

    if (error) {
      throw new BadRequestException(`Password reset failed: ${error.message}`);
    }

    // Always return success message (don't reveal if email exists)
    return {
      message: 'If this email exists, you will receive reset instructions.',
    };
  }

  /**
   * Reset password using Supabase Auth (called from frontend after email verification)
   * @param resetPasswordDto Contains the access token and new password
   * @returns Success message
   */
  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const { token, newPassword } = resetPasswordDto;
    const client = this.supabase.getClient();

    try {
      // Set the session using the token from the email link
      const {
        data: { user },
        error: sessionError,
      } = await client.auth.setSession({
        access_token: token,
        refresh_token: token, // For password reset, access_token can be used as refresh_token
      });

      if (sessionError || !user) {
        throw new UnauthorizedException('Invalid or expired reset token');
      }

      // Get user profile for audit trail
      const { data: profile } = await client
        .from('profiles')
        .select('email, role')
        .eq('id', user.id)
        .single();

      // Update the user's password using Supabase Auth
      const { error: updateError } = await client.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new BadRequestException(
          `Failed to update password: ${updateError.message}`,
        );
      }

      // Blacklist all existing tokens for this user
      await this.tokenBlacklistService.blacklistAllUserTokens(
        user.id,
        BlacklistReason.PASSWORD_CHANGE,
      );

      // Also invalidate refresh tokens
      await this.invalidateAllUserTokens(user.id);

      // Log audit trail
      await this.logAggregatorService.logAuditTrail({
        actorId: user.id,
        actorEmail: profile?.email || user.email || 'unknown',
        actorRole: profile?.role || 'user',
        action: 'reset_password',
        entityType: 'user_credentials',
        entityId: user.id,
        oldValues: {
          passwordSet: true,
        },
        newValues: {
          passwordReset: true,
          resetAt: new Date().toISOString(),
          allTokensRevoked: true,
        },
        changes: ['password', 'tokens_revoked'],
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        metadata: {
          resetMethod: 'email_token',
          securityAction: 'all_sessions_terminated',
        },
      });

      return { message: 'Password reset successfully' };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to reset password');
    }
  }

  /**
   * Blacklist token due to suspicious activity
   * @param token The token to blacklist
   * @param userId The user ID
   */
  async blacklistTokenForSuspiciousActivity(
    token: string,
    userId: string,
  ): Promise<void> {
    await this.tokenBlacklistService.blacklistToken(
      token,
      userId,
      BlacklistReason.SUSPICIOUS_ACTIVITY,
    );
  }

  /**
   * Blacklist all user tokens due to security breach
   * @param userId The user ID
   */
  async blacklistAllTokensForSecurityBreach(userId: string): Promise<void> {
    await this.tokenBlacklistService.blacklistAllUserTokens(
      userId,
      BlacklistReason.SECURITY_BREACH,
    );
  }

  /**
   * Invalidate all refresh tokens for a user
   * @param userId The user ID
   */
  private async invalidateAllUserTokens(userId: string): Promise<void> {
    const client = this.supabase.getClient();
    // Delete all refresh tokens for this user
    await client.from('refresh_tokens').delete().eq('user_id', userId);
  }

  private getUserRoleFromString(role: string | null): UserRole {
    switch (role) {
      case UserRole.ADMIN:
        return UserRole.ADMIN;
      case UserRole.MODERATOR:
        return UserRole.MODERATOR;
      case UserRole.USER:
      default:
        return UserRole.USER;
    }
  }

  private getValidProvider(
    provider: string | null | undefined,
  ): SocialProvider | 'email' {
    if (!provider) return 'email';

    // Check if it's a valid SocialProvider enum value
    if (Object.values(SocialProvider).includes(provider as SocialProvider)) {
      return provider as SocialProvider;
    }

    // Default to 'email' for any invalid provider values
    return 'email';
  }

  private getJwtExpirationTime(): number {
    // Option 1: Extract from JWT service configuration
    // If you have JWT_EXPIRES_IN in your config
    // const jwtConfig = this.jwtService['options']; // Access internal config

    // Option 2: Hard-code based on your JWT configuration
    return 900; // 15 minutes in seconds

    // Option 3: Decode the actual token to get expiry
    // const decoded = this.jwtService.decode(sessionData.accessToken);
    // return decoded.exp - Math.floor(Date.now() / 1000);
  }
}
