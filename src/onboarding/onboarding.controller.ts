import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OnboardingService } from './onboarding.service';
import {
  OnboardingStep,
  StartOnboardingDto,
  UpdateUserTypeDto,
  CompleteFirstAnalysisDto,
  UpdatePreferencesDto,
  OnboardingProgressResponse,
} from './dto/onboarding.dto';
import type { AuthenticatedRequest } from 'src/audit/models/authenticated-request.model';

@ApiTags('Onboarding')
@Controller('onboarding')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OnboardingController {
  private readonly logger = new Logger(OnboardingController.name);

  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('start')
  @ApiOperation({
    summary: 'Start user onboarding',
    description: 'Initialize the onboarding process for a new user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Onboarding started successfully',
    type: OnboardingProgressResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async startOnboarding(
    @Body() startOnboardingDto: StartOnboardingDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<OnboardingProgressResponse> {
    const userId = req.user.id;
    const ipAddress = req.ip || 'unknown';

    this.logger.log(`Starting onboarding for user: ${userId}`);

    return this.onboardingService.startOnboarding(
      userId,
      startOnboardingDto,
      ipAddress,
    );
  }

  @Put('user-type')
  @ApiOperation({
    summary: 'Update user type and preferences',
    description: 'Set user type, content categories, and video frequency',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User type updated successfully',
    type: OnboardingProgressResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async updateUserType(
    @Body() updateUserTypeDto: UpdateUserTypeDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<OnboardingProgressResponse> {
    const userId = req.user.id;
    const ipAddress = req.ip || 'unknown';

    this.logger.log(`Updating user type for user: ${userId}`);

    return this.onboardingService.updateUserType(
      userId,
      updateUserTypeDto,
      ipAddress,
    );
  }

  @Put('first-analysis')
  @ApiOperation({
    summary: 'Complete first video analysis',
    description: 'Mark the first analysis as complete and collect feedback',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'First analysis completed successfully',
    type: OnboardingProgressResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async completeFirstAnalysis(
    @Body() completeFirstAnalysisDto: CompleteFirstAnalysisDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<OnboardingProgressResponse> {
    const userId = req.user.id;
    const ipAddress = req.ip || 'unknown';

    this.logger.log(`Completing first analysis for user: ${userId}`);

    return this.onboardingService.completeFirstAnalysis(
      userId,
      completeFirstAnalysisDto,
      ipAddress,
    );
  }

  @Put('preferences')
  @ApiOperation({
    summary: 'Update user preferences',
    description: 'Set user preferences for notifications and content style',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Preferences updated successfully',
    type: OnboardingProgressResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async updatePreferences(
    @Body() updatePreferencesDto: UpdatePreferencesDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<OnboardingProgressResponse> {
    const userId = req.user.id;
    const ipAddress = req.ip || 'unknown';

    this.logger.log(`Updating preferences for user: ${userId}`);

    return this.onboardingService.updatePreferences(
      userId,
      updatePreferencesDto,
      ipAddress,
    );
  }

  @Put('skip/:step')
  @ApiOperation({
    summary: 'Skip onboarding step',
    description: 'Skip a specific step in the onboarding process',
  })
  @ApiParam({
    name: 'step',
    description: 'The onboarding step to skip',
    enum: OnboardingStep,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Step skipped successfully',
    type: OnboardingProgressResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid step provided',
  })
  async skipStep(
    @Param('step') step: OnboardingStep,
    @Req() req: AuthenticatedRequest,
  ): Promise<OnboardingProgressResponse> {
    const userId = req.user.id;
    const ipAddress = req.ip || 'unknown';

    this.logger.log(`Skipping step ${step} for user: ${userId}`);

    return this.onboardingService.skipStep(userId, step, ipAddress);
  }

  @Get('progress')
  @ApiOperation({
    summary: 'Get onboarding progress',
    description: 'Retrieve current onboarding progress for the user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Onboarding progress retrieved successfully',
    type: OnboardingProgressResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Onboarding progress not found',
  })
  async getProgress(
    @Req() req: AuthenticatedRequest,
  ): Promise<OnboardingProgressResponse> {
    const userId = req.user.id;

    this.logger.log(`Getting onboarding progress for user: ${userId}`);

    return this.onboardingService.getOnboardingProgress(userId);
  }

  @Put('complete')
  @ApiOperation({
    summary: 'Complete onboarding',
    description: 'Mark the entire onboarding process as complete',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Onboarding completed successfully',
    type: OnboardingProgressResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async completeOnboarding(
    @Req() req: AuthenticatedRequest,
  ): Promise<OnboardingProgressResponse> {
    const userId = req.user.id;
    const ipAddress = req.ip || 'unknown';

    this.logger.log(`Completing onboarding for user: ${userId}`);

    // Skip to completed step
    return this.onboardingService.skipStep(
      userId,
      OnboardingStep.COMPLETED,
      ipAddress,
    );
  }
}
