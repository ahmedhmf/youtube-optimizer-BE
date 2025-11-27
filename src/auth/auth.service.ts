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
import { User, UserProfileWithSubscription } from './types/user.interface';
import { Profile } from './types/profiles.type';
import { AuthResponse } from './types/auth-response.type';
import { RefreshTokens } from './types/refresh-token.type';
import { SocialRegistration } from './types/social-registeration.type';
import { TIER_FEATURES, SubscriptionTier } from '../DTO/subscription.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly socialAuthService: SocialAuthService,
    private readonly logAggregatorService: LogAggregatorService,
    private readonly emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, name } = registerDto;
    const client = this.supabase.getClient();

    // Use Supabase Auth to create user
    const { data: authData, error: authError } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split('@')[0],
        },
      },
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        throw new ConflictException('User with this email already exists');
      }
      throw new BadRequestException(`Registration failed: ${authError.message}`);
    }

    if (!authData.user) {
      throw new BadRequestException('Registration failed: No user returned');
    }

    // Profile will be auto-created by the database trigger
    // Wait a moment for the trigger to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Fetch the created profile
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select()
      .eq('id', authData.user.id)
      .single<Profile>();

    if (profileError) {
      this.logger.error('Profile not found after user creation:', profileError);
      // Profile might not exist yet, create it manually
      const { data: newProfile, error: createError } = await client
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: authData.user.email,
          name: name || email.split('@')[0],
          role: UserRole.USER,
          provider: 'email',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single<Profile>();

      if (createError) {
        throw new BadRequestException(
          `Profile creation failed: ${createError.message}`,
        );
      }
      // Use the newly created profile
      const finalProfile = newProfile;
    } else {
      // Use the fetched profile
      const finalProfile = profile;
    }

    // Get the final profile (either fetched or created)
    const { data: finalProfile, error: finalError } = await client
      .from('profiles')
      .select()
      .eq('id', authData.user.id)
      .single<Profile>();

    if (finalError || !finalProfile) {
      throw new BadRequestException('Failed to retrieve user profile');
    }

    const user: User = {
      id: finalProfile.id,
      email: finalProfile.email,
      name: finalProfile.name ?? '',
      role: this.getUserRoleFromString(finalProfile.role),
      picture: finalProfile.picture ?? '',
      provider: this.getValidProvider(finalProfile.provider),
      createdAt: new Date(finalProfile.created_at ?? ''),
      updatedAt: new Date(finalProfile.updated_at ?? ''),
    };

    // Send welcome email (non-blocking)
    this.emailService
      .sendWelcomeEmail(user.email, user.name || 'User')
      .catch((error) => {
        this.logger.error(
          `Failed to send welcome email to ${user.email}:`,
          error,
        );
      });

    // Return Supabase tokens
    return {
      accessToken: authData.session?.access_token ?? '',
      refreshToken: authData.session?.refresh_token ?? '',
      user,
      expiresIn: authData.session?.expires_in ?? 3600,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;
    const client = this.supabase.getClient();

    // Use Supabase Auth to sign in
    const { data: authData, error: authError } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Get user profile
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single<Profile>();

    if (profileError || !profile) {
      throw new UnauthorizedException('User profile not found');
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

    // Update last login
    await client
      .from('profiles')
      .update({
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    // Return Supabase tokens
    return {
      accessToken: authData.session?.access_token ?? '',
      refreshToken: authData.session?.refresh_token ?? '',
      user,
      expiresIn: authData.session?.expires_in ?? 3600,
    };
  }

  /**
   * Enhanced login with session security (when request/response objects are available)
   * Note: Now uses Supabase Auth directly
   */
  async loginWithSession(
    loginDto: LoginDto,
    request: express.Request,
    response: express.Response,
  ): Promise<AuthResponse> {
    // Use standard login which now returns Supabase tokens
    return this.login(loginDto);
  }

  async logout(userId: string, token?: string): Promise<{ success: boolean }> {
    const client = this.supabase.getClient();
    
    // Use Supabase Auth to sign out (invalidates all tokens)
    const { error } = await client.auth.signOut();
    
    if (error) {
      this.logger.error('Supabase logout error:', error);
      throw new BadRequestException('Logout failed');
    }

    return { success: true };
  }

  async refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  }> {
    const client = this.supabase.getClient();

    // Use Supabase Auth to refresh session
    const { data, error } = await client.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in ?? 3600,
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

  async getProfileWithSubscription(
    userId: string,
  ): Promise<UserProfileWithSubscription> {
    const client = this.supabase.getClient();

    try {
      // Get basic profile
      const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single<Profile>();

      if (profileError || !profile) {
        throw new UnauthorizedException('Profile not found');
      }

      // Get active subscription
      const { data: subscription, error: subError } = await client
        .from('user_subscriptions')
        .select(
          'tier, status, current_period_start, current_period_end, cancel_at_period_end, trial_end',
        )
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      // Default to FREE tier if no active subscription
      const tier = subscription?.tier || SubscriptionTier.FREE;
      const tierFeatures = TIER_FEATURES[tier];

      // Calculate usage for current billing period
      const periodStart = subscription?.current_period_start
        ? new Date(subscription.current_period_start)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1); // Start of current month

      const { count: analysesUsed, error: auditError } = await client
        .from('audits')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', periodStart.toISOString());

      const analysesAllowed =
        tierFeatures.maxAnalysesPerMonth === -1
          ? -1
          : tierFeatures.maxAnalysesPerMonth;

      const usagePercentage =
        analysesAllowed === -1
          ? 0
          : Math.min(
              Math.round(((analysesUsed || 0) / analysesAllowed) * 100),
              100,
            );

      return {
        id: profile.id,
        email: profile.email,
        name: profile.name ?? '',
        role: this.getUserRoleFromString(profile.role),
        picture: profile.picture ?? '',
        provider: this.getValidProvider(profile.provider),
        createdAt: new Date(profile.created_at ?? ''),
        updatedAt: new Date(profile.updated_at ?? ''),
        subscription: subscription
          ? {
              tier: subscription.tier,
              status: subscription.status,
              currentPeriodStart: subscription.current_period_start,
              currentPeriodEnd: subscription.current_period_end,
              cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
              trialEnd: subscription.trial_end || null,
            }
          : {
              tier: SubscriptionTier.FREE,
              status: 'active',
              currentPeriodStart: periodStart.toISOString(),
              currentPeriodEnd: new Date(
                periodStart.getFullYear(),
                periodStart.getMonth() + 1,
                0,
              ).toISOString(),
              cancelAtPeriodEnd: false,
              trialEnd: null,
            },
        usage: {
          analysesUsed: analysesUsed || 0,
          analysesAllowed,
          usagePercentage,
        },
        features: {
          maxAnalysesPerMonth: tierFeatures.maxAnalysesPerMonth,
          maxChannelsPerUser: tierFeatures.maxChannelsPerUser,
          advancedAnalytics: tierFeatures.advancedAnalytics,
          prioritySupport: tierFeatures.prioritySupport,
          customBranding: tierFeatures.customBranding,
          apiAccess: tierFeatures.apiAccess,
          bulkOperations: tierFeatures.bulkOperations,
          aiSuggestionsLimit: tierFeatures.aiSuggestionsLimit,
          exportFeatures: tierFeatures.exportFeatures,
          integrations: tierFeatures.integrations,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get profile with subscription:', error);
      throw error;
    }
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
    // Use service client with admin privileges
    const serviceClient = this.supabase.getServiceClient();

    // Step 1: Exchange authorization code with Google to get user info
    const googleUserInfo =
      await this.socialAuthService.exchangeGoogleCode(code);

    this.logger.debug(`Google OAuth: Authenticated user ${googleUserInfo.email}`);

    // Step 2: Create or get existing user in Supabase Auth using admin API
    // Check if user exists first
    const { data: existingUsers, error: listError } =
      await serviceClient.auth.admin.listUsers();

    if (listError) {
      this.logger.error(`Failed to list users: ${listError.message}`);
      throw new UnauthorizedException(
        `Failed to check existing users: ${listError.message}`,
      );
    }

    const existingUser = existingUsers.users.find(
      (u) => u.email === googleUserInfo.email,
    );

    let userId: string;
    let isNewUser = false;

    if (existingUser) {
      userId = existingUser.id;
      this.logger.debug(`User exists in Supabase Auth: ${userId}`);

      // Update user metadata with latest Google info
      const { error: updateError } = await serviceClient.auth.admin.updateUserById(
        userId,
        {
          user_metadata: {
            name: googleUserInfo.name,
            picture: googleUserInfo.picture,
            provider: 'google',
          },
        },
      );

      if (updateError) {
        this.logger.warn(`Failed to update user metadata: ${updateError.message}`);
      }
    } else {
      // Create new user in Supabase Auth using admin API
      const { data: newUser, error: createError } =
        await serviceClient.auth.admin.createUser({
          email: googleUserInfo.email,
          email_confirm: true, // Email is already verified by Google
          user_metadata: {
            name: googleUserInfo.name,
            picture: googleUserInfo.picture,
            provider: 'google',
          },
        });

      if (createError || !newUser.user) {
        this.logger.error(`Failed to create user: ${createError?.message}`);
        throw new BadRequestException(
          `Failed to create user in Supabase Auth: ${createError?.message}`,
        );
      }

      userId = newUser.user.id;
      isNewUser = true;
      this.logger.debug(`Created new user in Supabase Auth: ${userId}`);
    }

    // Step 3: Get or create profile in profiles table
    const client = this.supabase.getClient();
    const { data: existingProfile, error: profileError } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    let profile: Profile;

    if (existingProfile) {
      // Update existing profile
      const { data: updatedProfile, error: updateError } = await client
        .from('profiles')
        .update({
          name: googleUserInfo.name,
          picture: googleUserInfo.picture,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (updateError) {
        this.logger.warn(`Failed to update profile: ${updateError.message}`);
        profile = existingProfile;
      } else {
        profile = updatedProfile;
      }
    } else {
      // Create new profile (trigger should handle this, but create manually if needed)
      const { data: newProfile, error: createError } = await client
        .from('profiles')
        .insert({
          id: userId,
          email: googleUserInfo.email,
          name: googleUserInfo.name,
          picture: googleUserInfo.picture,
          provider: 'google',
          role: UserRole.USER,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError || !newProfile) {
        throw new BadRequestException(
          `Failed to create profile: ${createError?.message}`,
        );
      }

      profile = newProfile;
    }

    // Step 4: Create a session for the user
    // Generate a secure random password for OAuth users
    const tempPassword = crypto.randomBytes(32).toString('hex') + 'Aa1!';
    
    // Set/update password using admin API (OAuth users need a password for signInWithPassword)
    const { error: passwordError } = await serviceClient.auth.admin.updateUserById(
      userId,
      { password: tempPassword }
    );

    if (passwordError) {
      this.logger.error(`Failed to set password: ${passwordError.message}`);
      throw new UnauthorizedException(
        `Failed to set password: ${passwordError.message}`,
      );
    }

    // Sign in with the password to get a valid session with tokens
    const { data: signInData, error: signInError } = 
      await client.auth.signInWithPassword({
        email: googleUserInfo.email,
        password: tempPassword,
      });

    if (signInError || !signInData.session) {
      this.logger.error(`Failed to sign in: ${signInError?.message}`);
      throw new UnauthorizedException(
        `Failed to create session: ${signInError?.message}`,
      );
    }

    const session = signInData.session;

    // Step 5: Create User object
    const user: User = {
      id: userId,
      email: profile.email,
      name: profile.name ?? googleUserInfo.name,
      role: this.getUserRoleFromString(profile.role),
      picture: profile.picture ?? '',
      provider: this.getValidProvider(profile.provider ?? 'google'),
      createdAt: new Date(profile.created_at ?? new Date().toISOString()),
      updatedAt: new Date(profile.updated_at ?? new Date().toISOString()),
    };

    // Return Supabase Auth tokens
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in ?? 3600,
      user,
    };
  }

  async socialLoginWithSession(
    socialLoginDto: SocialLoginDto,
    request: any,
    response: any,
  ): Promise<AuthResponse> {
    // Use standard social login which now returns Supabase tokens
    return this.socialLogin(socialLoginDto);
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

    // Check if user exists (but don't reveal in response)
    const { data: profile } = await client
      .from('profiles')
      .select('id, email, name')
      .eq('email', email)
      .single();

      if (profile) {
      // Use Supabase Auth to send password reset email
      // Supabase will send an email with a secure link
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:4200'}/reset-password`,
      });

      if (error) {
        this.logger.error('Failed to send password reset email:', error);
      }
    }    // Always return success message (don't reveal if email exists)
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
        .select('email, role, name')
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

      // Supabase Auth automatically invalidates all sessions on password change
      
      // Send password changed confirmation email (non-blocking)
      if (profile?.email) {
        this.emailService
          .sendPasswordChangedEmail(profile.email, profile.name || 'User')
          .catch((error) => {
            this.logger.error(
              `Failed to send password changed email to ${profile.email}:`,
              error,
            );
          });
      }

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
   * Sign out user due to suspicious activity
   * @param userId The user ID
   */
  async signOutForSuspiciousActivity(userId: string): Promise<void> {
    const client = this.supabase.getClient();
    // Supabase Auth will invalidate all sessions
    await client.auth.signOut();
  }

  /**
   * Sign out all user sessions due to security breach
   * @param userId The user ID
   */
  async signOutAllForSecurityBreach(userId: string): Promise<void> {
    const client = this.supabase.getClient();
    // Supabase Auth handles session invalidation
    await client.auth.signOut();
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
