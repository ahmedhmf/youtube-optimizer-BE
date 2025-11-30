import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateInvitationDto,
  ValidateInvitationDto,
} from './dto/invitation.dto';
import { randomBytes } from 'crypto';

export interface Invitation {
  id: string;
  code: string;
  email: string | null;
  max_uses: number;
  current_uses: number;
  created_by: string | null;
  expires_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Generate a unique invitation code
   */
  private generateInvitationCode(): string {
    const random = randomBytes(4).toString('hex').toUpperCase();
    return `BETA-${random.slice(0, 4)}-${random.slice(4, 8)}`;
  }

  /**
   * Create a new invitation
   */
  async createInvitation(
    dto: CreateInvitationDto,
    createdBy: string,
  ): Promise<Invitation> {
    const code = this.generateInvitationCode();
    const expiresAt = dto.expiresInDays
      ? new Date(
          Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000,
        ).toISOString()
      : null;

    const client = this.supabaseService.getServiceClient();
    const { data, error } = await client
      .from('invitations')
      .insert({
        code,
        email: dto.email || null,
        max_uses: dto.maxUses || 1,
        created_by: createdBy,
        expires_at: expiresAt,
        metadata: dto.metadata || {},
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create invitation: ${error.message}`);
      throw new Error('Failed to create invitation');
    }

    this.logger.log(`Created invitation: ${code} for ${dto.email || 'anyone'}`);
    return data as Invitation;
  }

  /**
   * Validate an invitation code
   */
  async validateInvitation(
    dto: ValidateInvitationDto,
  ): Promise<{ valid: boolean; reason?: string; invitation?: Invitation }> {
    const client = this.supabaseService.getServiceClient();
    const { data: invitation, error } = await client
      .from('invitations')
      .select('*')
      .eq('code', dto.code)
      .single();

    if (error || !invitation) {
      return { valid: false, reason: 'Invalid invitation code' };
    }

    const invData = invitation as Invitation;

    // Check if expired
    if (invData.expires_at && new Date(invData.expires_at) < new Date()) {
      return { valid: false, reason: 'Invitation code has expired' };
    }

    // Check if all uses exhausted
    if (invData.current_uses >= invData.max_uses) {
      return { valid: false, reason: 'Invitation code has been fully used' };
    }

    // Check if email-restricted
    if (invData.email && dto.email && invData.email !== dto.email) {
      return {
        valid: false,
        reason: 'This invitation code is restricted to a different email address',
      };
    }

    return { valid: true, invitation: invData };
  }

  /**
   * Mark invitation as used
   */
  async markInvitationUsed(
    invitationId: string,
    userId: string,
  ): Promise<void> {
    const client = this.supabaseService.getServiceClient();

    // First, get current uses
    const { data: currentInv } = await client
      .from('invitations')
      .select('current_uses')
      .eq('id', invitationId)
      .single();

    // Increment current_uses
    const { error: updateError } = await client
      .from('invitations')
      .update({
        current_uses: (currentInv as any)?.current_uses + 1 || 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invitationId);

    if (updateError) {
      this.logger.error(
        `Failed to update invitation uses: ${updateError.message}`,
      );
    }

    // Record usage
    const { error: usageError } = await client
      .from('invitation_usage')
      .insert({
        invitation_id: invitationId,
        user_id: userId,
      });

    if (usageError) {
      this.logger.error(
        `Failed to record invitation usage: ${usageError.message}`,
      );
    }
  }

  /**
   * Get all invitations (admin only)
   */
  async getAllInvitations(): Promise<Invitation[]> {
    const client = this.supabaseService.getServiceClient();
    const { data, error } = await client
      .from('invitations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch invitations: ${error.message}`);
      throw new Error('Failed to fetch invitations');
    }

    return (data as Invitation[]) || [];
  }

  /**
   * Delete an invitation
   */
  async deleteInvitation(invitationId: string): Promise<void> {
    const client = this.supabaseService.getServiceClient();
    const { error } = await client
      .from('invitations')
      .delete()
      .eq('id', invitationId);

    if (error) {
      this.logger.error(`Failed to delete invitation: ${error.message}`);
      throw new Error('Failed to delete invitation');
    }

    this.logger.log(`Deleted invitation: ${invitationId}`);
  }

  /**
   * Get invitation statistics
   */
  async getInvitationStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    fullyUsed: number;
    totalUses: number;
  }> {
    const client = this.supabaseService.getServiceClient();
    const { data: invitations } = await client
      .from('invitations')
      .select('*');

    if (!invitations) {
      return { total: 0, active: 0, expired: 0, fullyUsed: 0, totalUses: 0 };
    }

    const invData = invitations as Invitation[];
    const now = new Date();
    const stats = {
      total: invData.length,
      active: 0,
      expired: 0,
      fullyUsed: 0,
      totalUses: 0,
    };

    invData.forEach((inv) => {
      stats.totalUses += inv.current_uses;

      if (inv.expires_at && new Date(inv.expires_at) < now) {
        stats.expired++;
      } else if (inv.current_uses >= inv.max_uses) {
        stats.fullyUsed++;
      } else {
        stats.active++;
      }
    });

    return stats;
  }
}
