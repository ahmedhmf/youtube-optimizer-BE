import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../supabase/supabase.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { LoginDto, RegisterDto, SocialLoginDto } from './dto';
import { User, AuthResponse } from './interfaces/user.interface';
import { UserRole } from './types/roles.types';
import { SocialAuthService } from './social-auth.service';
import { SocialProvider, SocialUserInfo } from './dto/social-login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly socialAuthService: SocialAuthService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, name } = registerDto;
    const client = this.supabase.getClient();

    console.log('Registration attempt for:', email);

    // Check if user already exists
    const { data: existingUser, error: checkError } = await client
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing user:', checkError);
      throw new BadRequestException(`Database error: ${checkError.message}`);
    }

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log('Password hashed successfully');

    // Generate a UUID for the new user
    const userId = crypto.randomUUID();
    console.log('Generated user ID:', userId);

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
      .single();

    if (profileError) {
      console.error('Profile creation failed:', profileError);
      throw new BadRequestException(
        `Profile creation failed: ${profileError.message}`,
      );
    }

    console.log('Profile created successfully:', profile.id);

    const user: User = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role || UserRole.USER,
      picture: profile.picture,
      provider: profile.provider || 'email',
      createdAt: new Date(profile.created_at),
      updatedAt: new Date(profile.updated_at),
    };

    const tokens = await this.generateTokens(user.id);

    // Store refresh token
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;
    const client = this.supabase.getClient();

    // Get user by email
    const { data: profile, error } = await client
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !profile) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      password,
      profile.password_hash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user: User = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role || UserRole.USER,
      picture: profile.picture,
      provider: profile.provider || 'email',
      createdAt: new Date(profile.created_at),
      updatedAt: new Date(profile.updated_at),
    };

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
    };
  }

  async logout(userId: string): Promise<{ success: boolean }> {
    const client = this.supabase.getClient();

    // Invalidate all refresh tokens for user
    await client.from('refresh_tokens').delete().eq('user_id', userId);

    return { success: true };
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    const client = this.supabase.getClient();

    // Validate refresh token
    const { data: tokenData, error } = await client
      .from('refresh_tokens')
      .select('user_id, expires_at')
      .eq('token', refreshToken)
      .single();

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
      newRefreshToken = await this.generateRefreshToken();
      await this.storeRefreshToken(tokenData.user_id, newRefreshToken);
    }

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async getProfile(userId: string): Promise<User> {
    const client = this.supabase.getClient();
    console.log('AuthService - getProfile called for ID:', userId);

    const { data: profile, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    console.log('AuthService - database query result:', { profile: !!profile, error });
    
    if (error) {
      console.log('AuthService - database error:', error);
      throw new UnauthorizedException(`Database error: ${error.message}`);
    }
    
    if (!profile) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role || UserRole.USER,
      picture: profile.picture,
      provider: profile.provider || 'email',
      createdAt: new Date(profile.created_at),
      updatedAt: new Date(profile.updated_at),
    };
  }

  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    const client = this.supabase.getClient();

    const allowedUpdates = ['name'];
    const filteredUpdates: any = {};

    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key as keyof User];
      }
    });

    filteredUpdates.updated_at = new Date().toISOString();

    const { data: profile, error } = await client
      .from('profiles')
      .update(filteredUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (error || !profile) {
      throw new BadRequestException('Failed to update profile');
    }

    return {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role || UserRole.USER,
      picture: profile.picture,
      provider: profile.provider || 'email',
      createdAt: new Date(profile.created_at),
      updatedAt: new Date(profile.updated_at),
    };
  }

  async validateUser(userId: string): Promise<User | null> {
    try {
      console.log('AuthService - validateUser called for ID:', userId);
      const user = await this.getProfile(userId);
      console.log('AuthService - user found:', user.email);
      return user;
    } catch (error) {
      console.log('AuthService - validateUser error:', error.message);
      return null;
    }
  }

  private async generateTokens(userId: string) {
    console.log('AuthService - generateTokens for user:', userId);
    console.log('AuthService - JWT_SECRET available:', !!process.env.JWT_SECRET);
    
    // Get user profile to include role in token
    const user = await this.getProfile(userId);
    const accessToken = this.jwtService.sign({ 
      sub: userId, 
      role: user.role 
    });
    
    console.log('AuthService - Generated token:', accessToken.substring(0, 50) + '...');
    const refreshToken = await this.generateRefreshToken();

    return {
      accessToken,
      refreshToken,
    };
  }

  private async generateRefreshToken(): Promise<string> {
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
    } else if (socialLoginDto.provider === SocialProvider.GITHUB) {
      if (!socialLoginDto.code) {
        throw new BadRequestException('GitHub code is required');
      }
      socialUserInfo = await this.socialAuthService.validateGitHubCode(
        socialLoginDto.code,
      );
    } else {
      throw new BadRequestException('Unsupported social provider');
    }

    // Check if user exists with this social provider
    const client = this.supabase.getClient();
    const { data: existingUser, error: queryError } = await client
      .from('profiles')
      .select('*')
      .eq('email', socialUserInfo.email)
      .single();

    let user: User;

    if (existingUser) {
      // Update existing user with social info
      const { data: updatedProfile, error: updateError } = await client
        .from('profiles')
        .update({
          name: existingUser.name || socialUserInfo.name,
          picture: socialUserInfo.picture,
          provider: socialUserInfo.provider,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id)
        .select()
        .single();

      if (updateError) {
        throw new BadRequestException(
          `Failed to update user profile: ${updateError.message}`,
        );
      }

      user = {
        id: updatedProfile.id,
        email: updatedProfile.email,
        name: updatedProfile.name,
        role: updatedProfile.role || UserRole.USER,
        picture: updatedProfile.picture,
        provider: updatedProfile.provider,
        createdAt: new Date(updatedProfile.created_at),
        updatedAt: new Date(updatedProfile.updated_at),
      };
    } else {
      // Create new user for social login
      const userId = crypto.randomUUID();

      const { data: newProfile, error: createError } = await client
        .from('profiles')
        .insert({
          id: userId,
          email: socialUserInfo.email,
          name: socialUserInfo.name,
          role: UserRole.USER,
          picture: socialUserInfo.picture,
          provider: socialUserInfo.provider,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // No password_hash for social users
        })
        .select()
        .single();

      if (createError) {
        throw new BadRequestException(
          `Failed to create user profile: ${createError.message}`,
        );
      }

      user = {
        id: newProfile.id,
        email: newProfile.email,
        name: newProfile.name,
        role: newProfile.role || UserRole.USER,
        picture: newProfile.picture,
        provider: newProfile.provider,
        createdAt: new Date(newProfile.created_at),
        updatedAt: new Date(newProfile.updated_at),
      };
    }

    // Generate JWT tokens
    const tokens = await this.generateTokens(user.id);

    // Store refresh token
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user,
    };
  }
}
