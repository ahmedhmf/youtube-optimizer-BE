import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Req,
  UseGuards,
  ValidationPipe,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/types/roles.types';
import {
  UserFeedbackService,
  FeedbackAnalytics,
} from './user-feedback.service';
import {
  SubmitFeedbackDto,
  FeatureRequestDto,
  UsageTrackingDto,
} from '../DTO/feedback.dto';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}

@ApiTags('User Feedback & Analytics')
@Controller('feedback')
@ApiBearerAuth('access-token')
export class UserFeedbackController {
  constructor(private readonly feedbackService: UserFeedbackService) {}

  @Post('submit')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit User Feedback',
    description:
      'Submit feedback about bugs, feature requests, or general improvements. Helps us understand user needs and prioritize development.',
  })
  @ApiBody({
    type: SubmitFeedbackDto,
    description: 'Feedback details and categorization',
  })
  @ApiResponse({
    status: 201,
    description: 'Feedback submitted successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid' },
        message: { type: 'string', example: 'Feedback submitted successfully' },
        status: { type: 'string', example: 'new' },
        submittedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid feedback data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  async submitFeedback(
    @Body(ValidationPipe) feedbackDto: SubmitFeedbackDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const feedback = await this.feedbackService.submitFeedback(
      req.user.id,
      {
        type: feedbackDto.type,
        title: feedbackDto.title,
        description: feedbackDto.description,
        priority: feedbackDto.priority,
        tags: feedbackDto.tags,
        current_page: feedbackDto.currentPage,
        user_agent: userAgent,
      },
      ipAddress,
    );

    return {
      id: feedback.id,
      message: 'Feedback submitted successfully',
      status: feedback.status,
      submittedAt: feedback.created_at,
    };
  }

  @Post('feature-request')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit Feature Request',
    description:
      'Request a new feature for the platform. Include detailed use cases and importance ratings to help prioritize development.',
  })
  @ApiBody({
    type: FeatureRequestDto,
    description: 'Feature request details with importance and use case',
  })
  @ApiResponse({
    status: 201,
    description: 'Feature request submitted successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid' },
        message: {
          type: 'string',
          example: 'Feature request submitted successfully',
        },
        votes: { type: 'number', example: 1 },
        status: { type: 'string', example: 'submitted' },
      },
    },
  })
  async submitFeatureRequest(
    @Body(ValidationPipe) requestDto: FeatureRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      'unknown';

    const featureRequest = await this.feedbackService.submitFeatureRequest(
      req.user.id,
      {
        feature_name: requestDto.featureName,
        description: requestDto.description,
        use_case: requestDto.useCase,
        importance: requestDto.importance,
        willingness_to_pay: requestDto.willingnessToPay,
        categories: requestDto.categories,
      },
      ipAddress,
    );

    return {
      id: featureRequest.id,
      message: 'Feature request submitted successfully',
      votes: featureRequest.votes,
      status: featureRequest.status,
    };
  }

  @Post('track-usage')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Track Feature Usage',
    description:
      'Track usage of specific features and user satisfaction. Helps understand feature adoption and user experience.',
  })
  @ApiBody({
    type: UsageTrackingDto,
    description: 'Usage tracking data with satisfaction rating',
  })
  @ApiResponse({
    status: 200,
    description: 'Usage tracked successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Usage tracked successfully' },
        tracked: { type: 'boolean', example: true },
      },
    },
  })
  async trackUsage(
    @Body(ValidationPipe) usageDto: UsageTrackingDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const sessionId = req.headers['session-id'] as string;

    await this.feedbackService.trackUsage(
      req.user.id,
      {
        feature: usageDto.feature,
        metadata: usageDto.metadata,
        satisfaction: usageDto.satisfaction,
        user_agent: userAgent,
      },
      sessionId,
      ipAddress,
    );

    return {
      message: 'Usage tracked successfully',
      tracked: true,
    };
  }

  @Get('my-feedback')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get User Feedback History',
    description: 'Retrieve all feedback submitted by the current user.',
  })
  @ApiResponse({
    status: 200,
    description: 'User feedback history retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string' },
          priority: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  async getMyFeedback(@Req() req: AuthenticatedRequest) {
    return this.feedbackService.getUserFeedbacks(req.user.id);
  }

  @Get('my-feature-requests')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get User Feature Requests',
    description: 'Retrieve all feature requests submitted by the current user.',
  })
  @ApiResponse({
    status: 200,
    description: 'User feature requests retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          feature_name: { type: 'string' },
          description: { type: 'string' },
          importance: { type: 'number' },
          votes: { type: 'number' },
          status: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  async getMyFeatureRequests(@Req() req: AuthenticatedRequest) {
    return this.feedbackService.getUserFeatureRequests(req.user.id);
  }

  @Post('vote/:featureId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Vote for Feature Request',
    description:
      'Vote for an existing feature request to show support and increase its priority.',
  })
  @ApiParam({
    name: 'featureId',
    description: 'ID of the feature request to vote for',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Vote recorded successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Vote recorded successfully' },
        voted: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Already voted for this feature',
  })
  async voteForFeature(
    @Param('featureId') featureId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.feedbackService.voteForFeature(req.user.id, featureId);
    return {
      message: 'Vote recorded successfully',
      voted: true,
    };
  }

  // Admin endpoints
  @Get('admin/analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({
    summary: 'Get Feedback Analytics (Admin)',
    description:
      'Get comprehensive analytics about user feedback, feature requests, and usage patterns.',
  })
  @ApiQuery({
    name: 'timeRange',
    enum: ['week', 'month', 'quarter'],
    required: false,
    description: 'Time range for analytics',
  })
  @ApiResponse({
    status: 200,
    description: 'Feedback analytics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalFeedbacks: { type: 'number' },
        feedbacksByType: { type: 'object' },
        averageSatisfaction: { type: 'number' },
        topRequestedFeatures: { type: 'array' },
        recentFeedbacks: { type: 'array' },
        featureUsageStats: { type: 'array' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getFeedbackAnalytics(
    @Query('timeRange') timeRange: 'week' | 'month' | 'quarter' = 'month',
  ): Promise<FeedbackAnalytics> {
    return this.feedbackService.getFeedbackAnalytics(timeRange);
  }
}
