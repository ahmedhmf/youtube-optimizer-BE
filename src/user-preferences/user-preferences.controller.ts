import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserPreferencesService } from './user-preferences.service';
import {
  CreateContentPreferencesDto,
  type UserContentPreferences,
} from './types/user-content-preferences.types';
import type { AuthenticatedRequest } from '../audit/models/authenticated-request.model';

@ApiTags('User Preferences')
@Controller('user-preferences')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserPreferencesController {
  private readonly logger = new Logger(UserPreferencesController.name);

  constructor(private readonly preferencesService: UserPreferencesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get user content preferences',
    description: 'Retrieve user preferences for content generation style',
  })
  @ApiResponse({
    status: 200,
    description: 'Preferences retrieved successfully',
  })
  async getPreferences(
    @Req() req: AuthenticatedRequest,
  ): Promise<UserContentPreferences | null> {
    const userId = req.user.id;
    return this.preferencesService.getPreferences(userId);
  }

  @Post()
  @ApiOperation({
    summary: 'Save user content preferences',
    description:
      'Create or update user preferences for content generation (upsert)',
  })
  @ApiResponse({
    status: 200,
    description: 'Preferences saved successfully',
  })
  async savePreferences(
    @Body() dto: CreateContentPreferencesDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<UserContentPreferences> {
    const userId = req.user.id;
    return this.preferencesService.upsertPreferences(userId, dto);
  }
}
