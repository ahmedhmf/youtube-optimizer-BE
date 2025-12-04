import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard';
import { InvitationService } from './invitation.service';
import {
  CreateInvitationDto,
  ValidateInvitationDto,
} from './dto/invitation.dto';
import type { AuthenticatedRequest } from 'src/user-feedback/types/authenticated-request.types';

@ApiTags('invitations')
@Controller('invitations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate invitation code',
    description: 'Check if an invitation code is valid before registration',
  })
  async validateInvitation(@Body() dto: ValidateInvitationDto) {
    const result = await this.invitationService.validateInvitation(dto);
    return {
      success: result.valid,
      message: result.reason || 'Invitation code is valid',
      data: result.valid ? { code: dto.code } : null,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create invitation (Admin only)',
    description: 'Generate a new invitation code for beta testing',
  })
  async createInvitation(
    @Body() dto: CreateInvitationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;
    const invitation = await this.invitationService.createInvitation(
      dto,
      userId,
    );
    return {
      success: true,
      message: 'Invitation created successfully',
      data: {
        code: invitation.code,
        email: invitation.email,
        maxUses: invitation.max_uses,
        expiresAt: invitation.expires_at,
      },
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List all invitations (Admin only)',
    description: 'Get all invitation codes and their status',
  })
  async getAllInvitations() {
    const invitations = await this.invitationService.getAllInvitations();
    return {
      success: true,
      data: invitations,
    };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get invitation statistics (Admin only)',
    description: 'Get statistics about invitations',
  })
  async getStats() {
    const stats = await this.invitationService.getInvitationStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete invitation (Admin only)',
    description: 'Revoke an invitation code',
  })
  async deleteInvitation(@Param('id') id: string) {
    await this.invitationService.deleteInvitation(id);
    return {
      success: true,
      message: 'Invitation deleted successfully',
    };
  }
}
