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
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import express from 'express';
import * as crypto from 'crypto';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CSRFGuard } from './guards/csrf.guard';
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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { User } from './types/user.interface';
import { AuditLoggingService } from 'src/common/audit-logging.service';
import { AuditEventType } from 'src/common/types/audit-event.type';
import { AuditStatus } from 'src/common/types/audit-status.type';
import { PasswordSecurityService } from 'src/common/password-security.service';
import { UserLogService } from 'src/logging/services/user-log.service';
import { LogSeverity, LogType } from 'src/logging/dto/log.types';
import { LogAggregatorService } from 'src/logging/services/log-aggregator.service';
import { ref } from 'process';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly auditLoggingService: AuditLoggingService,
    private readonly passwordSecurityService: PasswordSecurityService,
    private readonly userLogService: UserLogService,
    private readonly logAggregatorService: LogAggregatorService,
  ) {}

  @Post('register')
  @ApiOperation({
    summary: 'Register New User',
    description: `
    Creates a new user account in the system.
    
    **Requirements:**
    - Valid CSRF token (see /auth/csrf-token)
    - Unique email address
    - Strong password (min 8 chars, uppercase, lowercase, number)
    
    **Rate Limited:** 3 attempts per 5 minutes
    `,
  })
  @ApiBody({
    description: 'User registration data',
    type: RegisterDto, // Use your actual DTO
    examples: {
      'Valid Registration': {
        value: {
          email: 'user@example.com',
          password: 'SecurePass123!',
          name: 'John Doe',
          role: 'user',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'User registered successfully' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'uuid-123-456' },
            email: { type: 'string', example: 'user@example.com' },
            name: { type: 'string', example: 'John Doe' },
            role: { type: 'string', example: 'user' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation errors or user already exists',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          oneOf: [
            { type: 'string', example: 'User already exists' },
            {
              type: 'array',
              items: { type: 'string' },
              example: ['email must be a valid email', 'password is too weak'],
            },
          ],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'CSRF token missing or invalid',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: { type: 'string', example: 'Invalid CSRF token' },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 429 },
        message: {
          type: 'string',
          example: 'ThrottlerException: Too Many Requests',
        },
        error: { type: 'string', example: 'Too Many Requests' },
      },
    },
  })
  @ApiSecurity('csrf-token', ['X-CSRF-Token'])
  @UseGuards(CSRFGuard)
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 attempts per 5 minutes
  async register(
    @Body() registerDto: RegisterDto,
    @Req() req: express.Request,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    try {
      // Validate password security before registration
      await this.passwordSecurityService.validateRegistrationPassword(
        registerDto.password,
        undefined, // No user ID yet as they're registering
        ipAddress,
        userAgent,
      );

      const result = await this.authService.register(registerDto);

      // Log successful registration
      await this.userLogService.logActivity({
        userId: result.user?.id,
        logType: LogType.ACTIVITY,
        activityType: 'user_registration',
        description: `User registered successfully with email: ${registerDto.email}`,
        severity: LogSeverity.INFO,
        ipAddress,
        userAgent,
        metadata: {
          email: registerDto.email,
          registrationMethod: 'email',
        },
      });

      return result;
    } catch (error) {
      // Log failed registration attempt
      await this.userLogService.logActivity({
        logType: LogType.SECURITY,
        activityType: 'user_registration_failed',
        description: `Registration failed for email: ${registerDto.email}`,
        severity: LogSeverity.WARNING,
        ipAddress,
        userAgent,
        metadata: {
          email: registerDto.email,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      throw error;
    }
  }

  @Post('login')
  @ApiOperation({
    summary: 'Authenticate User',
    description: `
    Authenticates a user with email and password.
    
    **Security Features:**
    - CSRF protection required
    - Session security with device tracking
    - Rate limiting (5 attempts per minute)
    - Automatic fallback to standard auth if session fails
    
    **Returns:**
    - JWT access token (Bearer token for API calls)
    - Refresh token (HTTP-only cookie)
    - User profile information
    `,
    externalDocs: {
      description: 'Authentication Flow Documentation',
      url: 'https://your-docs.com/auth-flow',
    },
  })
  @ApiBody({
    description: 'Login credentials',
    type: LoginDto,
    examples: {
      'Standard Login': {
        value: {
          email: 'user@example.com',
          password: 'SecurePass123!',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful - Returns JWT token and user info',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          example:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiaWF0IjoxNjM3MTIzNDU2fQ.signature',
          description: 'JWT access token for API authentication',
        },
        refresh_token: {
          type: 'string',
          example: 'refresh_token_string_here',
          description: 'Refresh token (also set as HTTP-only cookie)',
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'uuid-123-456' },
            email: { type: 'string', example: 'user@example.com' },
            name: { type: 'string', example: 'John Doe' },
            role: { type: 'string', example: 'user' },
            permissions: {
              type: 'array',
              items: { type: 'string' },
              example: ['canUsePremiumFeatures', 'canCreateContent'],
            },
          },
        },
        session: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'session-uuid' },
            deviceInfo: { type: 'string', example: 'Chrome on Windows' },
            expiresAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Invalid email or password' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'CSRF token validation failed',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many login attempts',
  })
  @ApiSecurity('csrf-token', ['X-CSRF-Token'])
  @UseGuards(CSRFGuard)
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: express.Request,
    @Res() res: express.Response,
  ): Promise<express.Response<any, Record<string, any>>> {
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');

    try {
      // Use enhanced session security login
      const result = await this.authService.loginWithSession(
        loginDto,
        req,
        res,
      );

      // Check password breach status after successful login
      const passwordCheck =
        await this.passwordSecurityService.checkLoginPassword(
          loginDto.password,
          result.user?.id,
          ipAddress,
          userAgent,
        );

      // Log successful login
      await this.auditLoggingService.logAuthEvent(
        AuditEventType.LOGIN,
        result.user?.id,
        ipAddress,
        userAgent,
        {
          email: loginDto.email,
          loginMethod: 'session',
          passwordBreached: passwordCheck.shouldForcePasswordChange,
          passwordWarning: passwordCheck.warning,
        },
        AuditStatus.SUCCESS,
      );

      // Log user activity for successful login
      await this.userLogService.logActivity({
        userId: result.user?.id,
        logType: LogType.ACTIVITY,
        activityType: 'user_login',
        description: `User logged in successfully using session method`,
        severity: passwordCheck.shouldForcePasswordChange
          ? LogSeverity.WARNING
          : LogSeverity.INFO,
        ipAddress,
        userAgent,
        metadata: {
          email: loginDto.email,
          loginMethod: 'session',
          passwordBreached: passwordCheck.shouldForcePasswordChange,
        },
      });

      // Add password security info to response
      const responseData = {
        ...result,
        security: {
          shouldChangePassword: passwordCheck.shouldForcePasswordChange,
          passwordWarning: passwordCheck.warning,
        },
      };

      return res.json(responseData);
    } catch (sessionError) {
      console.warn(
        'Session security login failed, falling back to standard login:',
        sessionError,
      );

      try {
        // Fallback to regular login if session creation fails
        const result = await this.authService.login(loginDto);

        // Check password breach status after successful login
        const passwordCheck =
          await this.passwordSecurityService.checkLoginPassword(
            loginDto.password,
            result.user?.id,
            ipAddress,
            userAgent,
          );

        // Log successful login (fallback method)
        await this.auditLoggingService.logAuthEvent(
          AuditEventType.LOGIN,
          result.user?.id,
          ipAddress,
          userAgent,
          {
            email: loginDto.email,
            loginMethod: 'standard',
            passwordBreached: passwordCheck.shouldForcePasswordChange,
            passwordWarning: passwordCheck.warning,
            fallbackReason:
              sessionError instanceof Error
                ? sessionError.message
                : String(sessionError),
          },
          AuditStatus.SUCCESS,
        );

        // Log user activity for fallback login
        await this.userLogService.logActivity({
          userId: result.user?.id,
          logType: LogType.ACTIVITY,
          activityType: 'user_login',
          description: `User logged in successfully using standard method (fallback)`,
          severity: passwordCheck.shouldForcePasswordChange
            ? LogSeverity.WARNING
            : LogSeverity.INFO,
          ipAddress,
          userAgent,
          metadata: {
            email: loginDto.email,
            loginMethod: 'standard',
            passwordBreached: passwordCheck.shouldForcePasswordChange,
            fallbackReason:
              sessionError instanceof Error
                ? sessionError.message
                : String(sessionError),
          },
        });

        // Add password security info to response
        const responseData = {
          ...result,
          security: {
            shouldChangePassword: passwordCheck.shouldForcePasswordChange,
            passwordWarning: passwordCheck.warning,
          },
        };

        return res.json(responseData);
      } catch (error) {
        console.error('Login error:', error);

        // Log failed login attempt
        await this.auditLoggingService.logAuthEvent(
          AuditEventType.LOGIN_FAILED,
          undefined,
          ipAddress,
          userAgent,
          {
            email: loginDto.email,
            error: error instanceof Error ? error.message : String(error),
          },
          AuditStatus.FAILURE,
        );

        // Log user activity for failed login
        await this.userLogService.logActivity({
          logType: LogType.SECURITY,
          activityType: 'user_login_failed',
          description: `Login attempt failed for email: ${loginDto.email}`,
          severity: LogSeverity.WARNING,
          ipAddress,
          userAgent,
          metadata: {
            email: loginDto.email,
            error: error instanceof Error ? error.message : String(error),
          },
        });

        throw error;
      }
    }
  }

  @Post('logout')
  @ApiOperation({
    summary: 'Logout User',
    description: `
    Logs out the current user and invalidates their session.
    
    **Actions Performed:**
    - Invalidates JWT token
    - Removes refresh token cookie
    - Terminates active session
    - Logs security event
    `,
  })
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: 200,
    description: 'Successfully logged out',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Logged out successfully' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated - invalid or missing JWT token',
  })
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: express.Request,
    @Res() res: express.Response,
  ): Promise<express.Response<any, Record<string, any>>> {
    const token = this.extractTokenFromHeader(req);
    if (!token) {
      res.clearCookie('refresh_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });

      // Log logout without token
      await this.auditLoggingService.logAuthEvent(
        AuditEventType.LOGOUT,
        undefined,
        req.ip,
        req.get('User-Agent'),
        { reason: 'no_token' },
        AuditStatus.SUCCESS,
      );

      // Log user activity for logout without token
      await this.userLogService.logActivity({
        logType: LogType.ACTIVITY,
        activityType: 'user_logout',
        description: 'User logged out (no active token)',
        severity: LogSeverity.INFO,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { reason: 'no_token' },
      });

      return res.json({
        success: true,
        message: 'Logged out successfully (no active token)',
      });
    }

    try {
      // Try to decode the token to get user ID
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(
          Buffer.from(tokenParts[1], 'base64').toString(),
        ) as { sub?: string; [key: string]: any };
        const userId = payload.sub;

        if (userId) {
          // Blacklist the token
          try {
            await this.authService.logout(userId, token);

            // Log successful logout with token blacklisting
            await this.auditLoggingService.logAuthEvent(
              AuditEventType.LOGOUT,
              userId,
              req.ip,
              req.get('User-Agent'),
              {
                tokenBlacklisted: true,
                method: 'token_blacklist',
              },
              AuditStatus.SUCCESS,
            );

            // Log user activity for successful logout
            await this.userLogService.logActivity({
              userId,
              logType: LogType.ACTIVITY,
              activityType: 'user_logout',
              description: 'User logged out successfully',
              severity: LogSeverity.INFO,
              ipAddress: req.ip,
              userAgent: req.get('User-Agent'),
              metadata: {
                tokenBlacklisted: true,
                method: 'token_blacklist',
              },
            });
          } catch (blacklistError) {
            console.error('Error during token blacklisting:', blacklistError);

            // Log logout with blacklisting failure
            await this.auditLoggingService.logAuthEvent(
              AuditEventType.LOGOUT,
              userId,
              req.ip,
              req.get('User-Agent'),
              {
                tokenBlacklisted: false,
                error:
                  blacklistError instanceof Error
                    ? blacklistError.message
                    : String(blacklistError),
              },
              AuditStatus.WARNING,
            );
          }
        } else {
          await this.auditLoggingService.logAuthEvent(
            AuditEventType.LOGOUT,
            undefined,
            req.ip,
            req.get('User-Agent'),
            { reason: 'invalid_token_payload' },
            AuditStatus.WARNING,
          );
        }
      }

      // Clear session cookies regardless
      res.clearCookie('refresh_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });

      return res.json({
        success: true,
        message: 'Logged out successfully',
        tokenBlacklisted: true,
      });
    } catch (error) {
      console.error('Error during logout:', error);

      // Even if blacklisting fails, clear cookies and return success
      res.clearCookie('refresh_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });

      return res.json({
        success: true,
        message: 'Logged out with partial cleanup',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  @Post('refresh-with-token')
  @ApiOperation({
    summary: 'Refresh Authentication Token',
    description: `
  Refreshes the JWT access token using a valid refresh token.
  
  **Requirements:**
  - Valid refresh token (from HTTP-only cookie or request body)
  - CSRF token for security
  
  **Returns:**
  - New JWT access token
  - Updated refresh token (as HTTP-only cookie)
  - User session information
  `,
  })
  @ApiBody({
    description: 'Refresh token data (optional if using cookies)',
    type: RefreshTokenDto,
    required: false,
    examples: {
      'Token in Body': {
        value: {
          refreshToken: 'refresh_token_string_here',
        },
      },
      'Cookie Only': {
        value: {},
        description: 'Refresh token automatically read from HTTP-only cookie',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          description: 'New JWT access token',
        },
        refresh_token: {
          type: 'string',
          example: 'new_refresh_token_here',
          description: 'Updated refresh token (also set as cookie)',
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string' },
          },
        },
        expiresIn: {
          type: 'number',
          example: 3600,
          description: 'Token expiration time in seconds',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired refresh token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Failed to refresh token' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'CSRF token missing or invalid',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded - too many refresh attempts',
  })
  @ApiSecurity('csrf-token', ['X-CSRF-Token'])
  @UseGuards(CSRFGuard)
  async refresh(
    @Body() refreshDto: RefreshTokenDto,
    @Req() req: express.Request,
  ) {
    // Get refresh token from body or cookies
    const refreshToken =
      refreshDto.refreshToken ||
      req.cookies?.refresh_token ||
      req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const result = await this.authService.refresh(refreshToken);

    // Log token refresh
    await this.userLogService.logActivity({
      userId: (result as any).user?.id,
      logType: LogType.ACTIVITY,
      activityType: 'token_refreshed',
      description: 'User refreshed authentication token',
      severity: LogSeverity.INFO,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        method: 'refresh_token_body',
      },
    });

    return result;
  }

  @Get('profile')
  @ApiOperation({
    summary: 'Get User Profile',
    description: "Retrieves the authenticated user's profile information",
  })
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid-123-456' },
        email: { type: 'string', example: 'user@example.com' },
        name: { type: 'string', example: 'John Doe' },
        role: { type: 'string', example: 'user' },
        permissions: {
          type: 'array',
          items: { type: 'string' },
        },
        createdAt: { type: 'string', format: 'date-time' },
        lastLoginAt: { type: 'string', format: 'date-time' },
        profilePicture: {
          type: 'string',
          example: 'https://example.com/avatar.jpg',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid JWT token',
  })
  @UseGuards(JwtAuthGuard)
  async getProfile(
    @Req() req: Request & { user: { id: string } },
  ): Promise<User> {
    return this.authService.getProfile(req.user.id);
  }

  @Get('profile/subscription')
  @ApiOperation({
    summary: 'Get User Profile with Subscription',
    description:
      "Retrieves the authenticated user's profile with subscription information, usage statistics, and feature limits",
  })
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: 200,
    description: 'Profile with subscription retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid-123-456' },
        email: { type: 'string', example: 'user@example.com' },
        name: { type: 'string', example: 'John Doe' },
        role: { type: 'string', example: 'user' },
        picture: { type: 'string', example: 'https://example.com/avatar.jpg' },
        provider: { type: 'string', example: 'google' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        subscription: {
          type: 'object',
          properties: {
            tier: {
              type: 'string',
              enum: ['free', 'pro', 'premium', 'enterprise'],
              example: 'pro',
            },
            status: {
              type: 'string',
              enum: [
                'active',
                'inactive',
                'cancelled',
                'past_due',
                'trialing',
                'paused',
              ],
              example: 'active',
            },
            currentPeriodStart: { type: 'string', format: 'date-time' },
            currentPeriodEnd: { type: 'string', format: 'date-time' },
            cancelAtPeriodEnd: { type: 'boolean', example: false },
            trialEnd: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        usage: {
          type: 'object',
          properties: {
            analysesUsed: { type: 'number', example: 45 },
            analysesAllowed: {
              type: 'number',
              example: 100,
              description: '-1 for unlimited',
            },
            usagePercentage: { type: 'number', example: 45 },
          },
        },
        features: {
          type: 'object',
          properties: {
            maxAnalysesPerMonth: { type: 'number', example: 100 },
            maxChannelsPerUser: { type: 'number', example: 3 },
            advancedAnalytics: { type: 'boolean', example: true },
            prioritySupport: { type: 'boolean', example: false },
            customBranding: { type: 'boolean', example: false },
            apiAccess: { type: 'boolean', example: true },
            bulkOperations: { type: 'boolean', example: false },
            aiSuggestionsLimit: { type: 'number', example: 10 },
            exportFeatures: { type: 'boolean', example: true },
            integrations: { type: 'boolean', example: false },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid JWT token',
  })
  @UseGuards(JwtAuthGuard)
  async getProfileWithSubscription(
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.authService.getProfileWithSubscription(req.user.id);
  }

  @Put('profile')
  @ApiOperation({
    summary: 'Update User Profile',
    description: "Updates the authenticated user's profile information",
  })
  @ApiBearerAuth('access-token')
  @ApiSecurity('csrf-token', ['X-CSRF-Token'])
  @ApiBody({
    type: UpdateProfileDto,
    examples: {
      'Profile Update': {
        value: {
          name: 'Jane Doe',
          bio: 'Software Developer',
          preferences: {
            theme: 'dark',
            notifications: true,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'CSRF token required',
  })
  @UseGuards(JwtAuthGuard, CSRFGuard)
  async updateProfile(
    @Req() req: Request & { user: { id: string } },
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<User> {
    const ipAddress = (req as any).ip || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await this.authService.updateProfile(
      req.user.id,
      updateProfileDto,
      ipAddress,
      userAgent,
    );

    // Log profile update
    await this.userLogService.logActivity({
      userId: req.user.id,
      logType: LogType.ACTIVITY,
      activityType: 'profile_updated',
      description: 'User updated their profile information',
      severity: LogSeverity.INFO,
      ipAddress,
      userAgent,
      metadata: {
        updatedFields: Object.keys(updateProfileDto),
      },
    });

    // Audit trail is logged in AuthService.updateProfile()

    return result;
  }

  @Get('social/google/url')
  @ApiOperation({
    summary: 'Get Google OAuth URL',
    description: `
    Returns the Google OAuth authorization URL for the frontend to redirect users.
    
    **Frontend Usage:**
    1. Call this endpoint to get the OAuth URL
    2. Redirect user to the returned URL
    3. Google redirects back to backend callback
    4. Backend redirects to frontend with auth result
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Google OAuth URL generated successfully',
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          example: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=...',
          description: 'Complete Google OAuth authorization URL',
        },
        state: {
          type: 'string',
          example: 'random-csrf-token-123',
          description: 'CSRF state token (store this to validate callback)',
        },
      },
    },
  })
  getGoogleAuthUrl() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI ||
      `${process.env.BACKEND_URL || 'http://localhost:3000'}/auth/social/google`;

    if (!clientId) {
      throw new BadRequestException('Google OAuth is not configured');
    }

    // Generate CSRF state token
    const state = crypto.randomBytes(32).toString('hex');

    // Store state in session or cache for validation (optional but recommended)
    // You could also return it to frontend to store temporarily

    const googleAuthUrl =
      'https://accounts.google.com/o/oauth2/v2/auth?' +
      new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        access_type: 'offline',
        prompt: 'consent',
      }).toString();

    return {
      url: googleAuthUrl,
      state,
    };
  }

  @Post('social/google')
  @ApiOperation({
    summary: 'Google OAuth Login',
    description: `
    Authenticates user via Google OAuth token.
    
    **Flow:**
    1. Client obtains Google OAuth token
    2. Send token to this endpoint
    3. Server verifies token with Google
    4. Creates/updates user account
    5. Returns JWT tokens
    `,
  })
  @ApiBody({
    type: SocialLoginRequestDto,
    examples: {
      'Google Login': {
        value: {
          token: 'google_oauth_token_here',
          provider: 'google',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Google authentication successful',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid Google token',
  })
  async googleLogin(
    @Body() body: SocialLoginRequestDto,
    @Req() req: express.Request,
    @Res() res: express.Response,
  ): Promise<express.Response<any, Record<string, any>>> {
    const ipAddress = req.ip || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    try {
      if (!body.token) {
        // Log missing token attempt
        await this.auditLoggingService.logAuthEvent(
          AuditEventType.LOGIN_FAILED,
          undefined,
          ipAddress,
          userAgent,
          {
            provider: 'google',
            error: 'Google token is required',
            tokenProvided: false,
          },
          AuditStatus.FAILURE,
        );
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

      // Log successful Google login
      await this.auditLoggingService.logAuthEvent(
        AuditEventType.LOGIN,
        result.user?.id,
        ipAddress,
        userAgent,
        {
          provider: 'google',
          loginMethod: 'social_session',
          email: result.user?.email,
        },
        AuditStatus.SUCCESS,
      );

      // Log user activity for Google login
      await this.userLogService.logActivity({
        userId: result.user?.id,
        logType: LogType.ACTIVITY,
        activityType: 'user_login_social',
        description: 'User logged in successfully via Google',
        severity: LogSeverity.INFO,
        ipAddress,
        userAgent,
        metadata: {
          provider: 'google',
          loginMethod: 'social_session',
          email: result.user?.email,
        },
      });

      return res.json(result);
    } catch (sessionError) {
      console.warn(
        'Session security login failed, falling back to standard login:',
        sessionError,
      );

      try {
        // Fallback to regular login if session creation fails
        const result = await this.authService.socialLogin({
          token: body.token,
          provider: SocialProvider.GOOGLE,
        });

        // Log successful Google login (fallback method)
        await this.auditLoggingService.logAuthEvent(
          AuditEventType.LOGIN,
          result.user?.id,
          ipAddress,
          userAgent,
          {
            provider: 'google',
            loginMethod: 'social_standard',
            email: result.user?.email,
            fallbackReason:
              sessionError instanceof Error
                ? sessionError.message
                : String(sessionError),
          },
          AuditStatus.SUCCESS,
        );

        // Log user activity for Google login (fallback)
        await this.userLogService.logActivity({
          userId: result.user?.id,
          logType: LogType.ACTIVITY,
          activityType: 'user_login_social',
          description: 'User logged in successfully via Google (fallback)',
          severity: LogSeverity.INFO,
          ipAddress,
          userAgent,
          metadata: {
            provider: 'google',
            loginMethod: 'social_standard',
            email: result.user?.email,
            fallbackReason:
              sessionError instanceof Error
                ? sessionError.message
                : String(sessionError),
          },
        });

        return res.json(result);
      } catch (error) {
        console.error('Google login error:', error);

        // Log failed Google login attempt with detailed error information
        await this.auditLoggingService.logAuthEvent(
          AuditEventType.LOGIN_FAILED,
          undefined,
          ipAddress,
          userAgent,
          {
            provider: 'google',
            error: error instanceof Error ? error.message : String(error),
            errorType:
              error instanceof Error ? error.constructor.name : typeof error,
            tokenProvided: !!body.token,
            tokenLength: body.token?.length || 0,
            sessionErrorMessage:
              sessionError instanceof Error
                ? sessionError.message
                : String(sessionError),
          },
          AuditStatus.FAILURE,
        );

        // Log user activity for failed Google login
        await this.userLogService.logActivity({
          logType: LogType.SECURITY,
          activityType: 'user_login_social_failed',
          description: 'Google login attempt failed',
          severity: LogSeverity.WARNING,
          ipAddress,
          userAgent,
          metadata: {
            provider: 'google',
            error: error instanceof Error ? error.message : String(error),
            tokenProvided: !!body.token,
          },
        });

        throw error;
      }
    }
  }

  @Get('social/google')
  @ApiOperation({
    summary: 'Google OAuth Callback',
    description: `
    Handles the OAuth callback redirect from Google.
    
    **OAuth Flow:**
    1. User clicks "Login with Google"
    2. Redirected to Google OAuth consent screen
    3. Google redirects back to this endpoint with auth code
    4. Server exchanges code for user info and creates session
    5. Redirects to frontend with success/error status
    `,
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to frontend with auth result',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid OAuth state or code',
  })
  async googleCallback(
    @Req() req: express.Request,
    @Res() res: express.Response,
  ): Promise<void> {
    const { state, code } = req.query;
    const ipAddress = req.ip || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const stateStr = typeof state === 'string' ? state : '';

    // Debug: Log all query parameters
    this.logger.debug('Google OAuth callback received', {
      queryParams: req.query,
      hasCode: !!code,
      hasState: !!state,
      codeType: typeof code,
      stateType: typeof state,
    });

    try {
      // Check for OAuth errors from Google
      const error = req.query.error;
      if (error) {
        const errorDescription = req.query.error_description || 'OAuth error';
        throw new BadRequestException(
          `Google OAuth error: ${errorDescription}`,
        );
      }

      // Validate required parameters
      if (!state || typeof state !== 'string') {
        throw new BadRequestException(
          'Invalid OAuth state - please restart login flow',
        );
      }

      if (!code || typeof code !== 'string') {
        throw new BadRequestException(
          'Authorization code is required - please restart login flow',
        );
      }

      // Exchange code for tokens and create user session
      const result = await this.authService.handleGoogleCallback(
        code,
        req,
        res,
      );

      // Log successful Google OAuth login
      await this.auditLoggingService.logAuthEvent(
        AuditEventType.LOGIN,
        result.user?.id,
        ipAddress,
        userAgent,
        {
          provider: 'google',
          loginMethod: 'oauth_callback',
          email: result.user?.email,
        },
        AuditStatus.SUCCESS,
      );

      await this.userLogService.logActivity({
        userId: result.user?.id,
        logType: LogType.ACTIVITY,
        activityType: 'user_login_social',
        description: 'User logged in successfully via Google OAuth',
        severity: LogSeverity.INFO,
        ipAddress,
        userAgent,
        metadata: {
          provider: 'google',
          loginMethod: 'oauth_callback',
          email: result.user?.email,
        },
      });

      // Redirect to frontend with success and tokens
      const frontendCallbackUrl =
        process.env.FRONTEND_CALLBACK_URL ||
        'http://localhost:4200/auth/callback';

      // Encode tokens for URL safety and pass to frontend
      const redirectUrl = `${frontendCallbackUrl}?success=true&state=${encodeURIComponent(String(state))}&access_token=${encodeURIComponent(String(result.accessToken))}&refresh_token=${encodeURIComponent(String(result.refreshToken))}`;

      res.redirect(redirectUrl);
    } catch (error) {
      this.logger.error('Google OAuth callback error:', error);

      // Log failed Google OAuth login
      await this.auditLoggingService.logAuthEvent(
        AuditEventType.LOGIN_FAILED,
        undefined,
        ipAddress,
        userAgent,
        {
          provider: 'google',
          loginMethod: 'oauth_callback',
          error: error instanceof Error ? error.message : String(error),
          codeProvided: !!code,
          stateProvided: !!state,
        },
        AuditStatus.FAILURE,
      );

      await this.userLogService.logActivity({
        logType: LogType.SECURITY,
        activityType: 'user_login_social_failed',
        description: 'Google OAuth login attempt failed',
        severity: LogSeverity.WARNING,
        ipAddress,
        userAgent,
        metadata: {
          provider: 'google',
          error: error instanceof Error ? error.message : String(error),
        },
      });

      // Redirect to frontend with error
      const frontendCallbackUrl =
        process.env.FRONTEND_CALLBACK_URL ||
        'http://localhost:4200/auth/callback';
      const errorMessage = encodeURIComponent(
        error instanceof Error ? error.message : 'OAuth authentication failed',
      );
      const errorUrl = `${frontendCallbackUrl}?error=${errorMessage}&state=${stateStr}`;

      res.redirect(errorUrl);
    }
  }

  @Post('forgot-password')
  @ApiOperation({
    summary: 'Request Password Reset',
    description: `
  Initiates a password reset process by sending a reset link to the user's email.
  
  **Security Features:**
  - Rate limited to prevent abuse
  - CSRF protection
  - Email validation
  - Secure reset token generation
  
  **Process:**
  1. Validates email exists in system
  2. Generates secure reset token
  3. Sends email with reset link
  4. Token expires in 1 hour
  `,
  })
  @ApiBody({
    type: ForgotPasswordDto,
    description: 'Email address for password reset',
    examples: {
      'Password Reset Request': {
        value: {
          email: 'user@example.com',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Password reset instructions sent to your email',
        },
        email: { type: 'string', example: 'user@example.com' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid email address or user not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'User with this email does not exist',
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'CSRF token required',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many password reset requests - rate limited',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 429 },
        message: {
          type: 'string',
          example: 'Too many password reset attempts. Try again in 5 minutes.',
        },
      },
    },
  })
  @ApiSecurity('csrf-token', ['X-CSRF-Token'])
  @UseGuards(CSRFGuard)
  @Throttle({ default: { limit: 2, ttl: 300000 } }) // 2 attempts per 5 minutes
  async requestPasswordReset(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Req() req: express.Request,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    try {
      const result =
        await this.authService.requestPasswordReset(forgotPasswordDto);

      // Log password reset request
      await this.userLogService.logActivity({
        logType: LogType.SECURITY,
        activityType: 'password_reset_requested',
        description: `Password reset requested for email: ${forgotPasswordDto.email}`,
        severity: LogSeverity.INFO,
        ipAddress,
        userAgent,
        metadata: {
          email: forgotPasswordDto.email,
        },
      });

      return result;
    } catch (error) {
      // Log failed password reset request
      await this.userLogService.logActivity({
        logType: LogType.SECURITY,
        activityType: 'password_reset_request_failed',
        description: `Password reset request failed for email: ${forgotPasswordDto.email}`,
        severity: LogSeverity.WARNING,
        ipAddress,
        userAgent,
        metadata: {
          email: forgotPasswordDto.email,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      throw error;
    }
  }

  @Post('reset-password')
  @ApiOperation({
    summary: 'Reset User Password',
    description: `
  Completes the password reset process using a valid reset token.
  
  **Requirements:**
  - Valid reset token (from email link)
  - New password meeting security requirements
  - CSRF protection
  
  **Security:**
  - Token expires after 1 hour
  - One-time use tokens
  - Password strength validation
  - Automatic login after reset
  `,
  })
  @ApiBody({
    type: ResetPasswordDto,
    description: 'Password reset data with token and new password',
    examples: {
      'Password Reset': {
        value: {
          token: 'reset_token_from_email',
          newPassword: 'NewSecurePassword123!',
          confirmPassword: 'NewSecurePassword123!',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Password reset successful' },
        access_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          description: 'JWT token for automatic login',
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid or expired reset token, or password validation failed',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          oneOf: [
            { type: 'string', example: 'Invalid or expired reset token' },
            { type: 'string', example: 'Password does not meet requirements' },
            { type: 'string', example: 'Passwords do not match' },
          ],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'CSRF token required',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many reset attempts',
  })
  @ApiSecurity('csrf-token', ['X-CSRF-Token'])
  @UseGuards(CSRFGuard)
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 attempts per 5 minutes
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
    @Req() req: express.Request,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    try {
      // Validate password security before reset
      await this.passwordSecurityService.validatePasswordChange(
        resetPasswordDto.newPassword,
        resetPasswordDto.token, // Use token as user identifier for now
        ipAddress,
        userAgent,
      );

      const result = await this.authService.resetPassword(
        resetPasswordDto,
        ipAddress,
        userAgent,
      );

      // Log successful password reset
      await this.userLogService.logActivity({
        logType: LogType.SECURITY,
        activityType: 'password_reset_completed',
        description: 'User successfully reset their password',
        severity: LogSeverity.WARNING,
        ipAddress,
        userAgent,
        metadata: {
          resetMethod: 'email_token',
        },
      });

      // Audit trail is logged in AuthService.resetPassword()

      return result;
    } catch (error) {
      // Log failed password reset
      await this.userLogService.logActivity({
        logType: LogType.SECURITY,
        activityType: 'password_reset_failed',
        description: 'Password reset attempt failed',
        severity: LogSeverity.ERROR,
        ipAddress,
        userAgent,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      });

      throw error;
    }
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh Authentication Token',
    description: `
  Refreshes the JWT access token using a valid refresh token.
  
  **Requirements:**
  - Valid refresh token (from HTTP-only cookie or request body)
  - CSRF token for security
  
  **Returns:**
  - New JWT access token
  - Updated refresh token (as HTTP-only cookie)
  - User session information
  `,
  })
  @ApiBody({
    description: 'Refresh token data (optional if using cookies)',
    type: RefreshTokenDto,
    required: false,
    examples: {
      'Token in Body': {
        value: {
          refreshToken: 'refresh_token_string_here',
        },
      },
      'Cookie Only': {
        value: {},
        description: 'Refresh token automatically read from HTTP-only cookie',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          description: 'New JWT access token',
        },
        refresh_token: {
          type: 'string',
          example: 'new_refresh_token_here',
          description: 'Updated refresh token (also set as cookie)',
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string' },
          },
        },
        expiresIn: {
          type: 'number',
          example: 3600,
          description: 'Token expiration time in seconds',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired refresh token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Failed to refresh token' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'CSRF token missing or invalid',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded - too many refresh attempts',
  })
  @ApiSecurity('csrf-token', ['X-CSRF-Token'])
  @UseGuards(CSRFGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 attempts per minute
  async refreshToken(
    @Body() refreshDto: RefreshTokenDto,
    @Req() req: express.Request,
  ) {
    try {
      // Get refresh token from body or cookies
      const refreshToken =
        refreshDto.refreshToken ||
        req.cookies?.refresh_token ||
        req.cookies?.refreshToken;

      if (!refreshToken) {
        throw new UnauthorizedException('Refresh token is required');
      }

      const result = await this.authService.refresh(refreshToken);

      // Log token refresh
      await this.userLogService.logActivity({
        userId: (result as any).user?.id,
        logType: LogType.ACTIVITY,
        activityType: 'token_refreshed',
        description: 'User refreshed authentication token',
        severity: LogSeverity.INFO,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          method: 'refresh_token',
        },
      });

      return result;
    } catch (error) {
      // Don't log here - GlobalExceptionFilter will log it
      throw new UnauthorizedException(
        error instanceof Error &&
        !error.message.includes('Cannot read properties')
          ? error.message
          : 'Invalid or expired session',
      );
    }
  }

  @Get('sessions')
  @ApiOperation({
    summary: 'List User Sessions',
    description: 'Retrieves all active sessions for the authenticated user',
  })
  @ApiBearerAuth('access-token')
  @ApiSecurity('csrf-token', ['X-CSRF-Token'])
  @ApiResponse({
    status: 200,
    description: 'Sessions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        sessions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              deviceInfo: { type: 'string' },
              ipAddress: { type: 'string' },
              lastActivity: { type: 'string', format: 'date-time' },
              isCurrentSession: { type: 'boolean' },
            },
          },
        },
      },
    },
  })
  @UseGuards(JwtAuthGuard, CSRFGuard)
  async getUserSessions(@Req() req: Request & { user: { id: string } }) {
    // Supabase Auth doesn't expose session management
    // Return empty array for now
    return { sessions: [] };
  }

  @Post('logout-all')
  @ApiOperation({
    summary: 'Logout from All Devices',
    description: `
  Logs out the user from all active sessions and devices.
  
  **Actions Performed:**
  - Invalidates all JWT tokens for the user
  - Revokes all active sessions
  - Clears all refresh tokens
  - Removes session cookies
  - Logs security event
  
  **Use Cases:**
  - Security breach response
  - Account compromise mitigation
  - User-initiated security cleanup
  `,
  })
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: 200,
    description: 'Successfully logged out from all devices',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Logged out from all devices successfully',
        },
        revokedSessions: {
          type: 'number',
          example: 3,
          description: 'Number of sessions that were terminated',
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          description: 'When the logout occurred',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid JWT token',
  })
  @UseGuards(JwtAuthGuard)
  async logoutAllDevices(
    @Req() req: Request & { user: { id: string } },
    @Res() res: express.Response,
  ) {
    // Supabase Auth signOut handles session invalidation
    await this.authService.logout(req.user.id);

    // Log logout from all devices
    await this.userLogService.logActivity({
      userId: req.user.id,
      logType: LogType.SECURITY,
      activityType: 'logout_all_devices',
      description: 'User logged out from all devices',
      severity: LogSeverity.WARNING,
      ipAddress: (req as any).ip,
      userAgent: req.headers['user-agent'] || 'unknown',
      metadata: {
        reason: 'user_initiated',
      },
    });

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    return res.json({ message: 'Logged out from all devices' });
  }

  @Delete('sessions/:sessionId')
  @ApiOperation({
    summary: 'Revoke Specific Session',
    description: `
  Revokes a specific active session by its ID.
  
  **Security:**
  - Users can only revoke their own sessions
  - CSRF protection required
  - Session validation
  - Automatic cleanup of associated tokens
  
  **Use Cases:**
  - Remove suspicious login
  - Logout specific device
  - Session management
  `,
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Unique identifier of the session to revoke',
    example: 'session-uuid-12345',
    type: 'string',
  })
  @ApiBearerAuth('access-token')
  @ApiSecurity('csrf-token', ['X-CSRF-Token'])
  @ApiResponse({
    status: 200,
    description: 'Session revoked successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Session revoked successfully' },
        sessionId: { type: 'string', example: 'session-uuid-12345' },
        revokedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Session not found or does not belong to user',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'Session not found or unauthorized',
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'CSRF token required',
  })
  @UseGuards(JwtAuthGuard, CSRFGuard)
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @Req() req: Request & { user: { id: string } },
    @Res() res: express.Response,
  ): Promise<express.Response<any, Record<string, any>>> {
    // Supabase Auth handles session management
    // This endpoint is deprecated
    return res.status(400).json({
      error: 'Deprecated',
      message: 'Session management is now handled by Supabase Auth',
    });
  }

  /**
   * Extract JWT token from Authorization header
   */
  private extractTokenFromHeader(request: express.Request): string | undefined {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        return undefined;
      }

      const [type, token] = authHeader.split(' ');
      if (type !== 'Bearer' || !token) {
        return undefined;
      }

      return token;
    } catch {
      return undefined;
    }
  }
}
