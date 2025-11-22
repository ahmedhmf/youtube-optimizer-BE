import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AccountLockout } from './types/account-lockouts.type';
import { AccountLockoutStatus } from './types/account-lockout-status.type';
import { LockoutConfig } from './types/lockout-config.type';

@Injectable()
export class AccountLockoutService {
  private readonly logger = new Logger(AccountLockoutService.name);

  // Default configuration - can be overridden via environment variables
  private readonly config: LockoutConfig = {
    maxAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
    lockoutDurationMinutes: parseInt(
      process.env.LOCKOUT_DURATION_MINUTES || '15',
    ),
    resetWindowMinutes: parseInt(process.env.RESET_WINDOW_MINUTES || '60'),
  };

  constructor(private readonly supabaseService: SupabaseService) {}

  async recordFailedAttempt(identifier: string): Promise<AccountLockoutStatus> {
    const supabase = this.supabaseService.getClient();

    try {
      // Get current lockout record
      const { data: existingRecord } = await supabase
        .from('account_lockouts')
        .select('*')
        .eq('identifier', identifier)
        .maybeSingle<AccountLockout>(); // Use maybeSingle() to avoid error when no record exists

      const now = new Date();
      let failedAttempts = 1;
      let firstFailureAt = now;

      if (existingRecord) {
        const record = existingRecord;
        const recordTime = new Date(record.first_failure_at);
        const timeSinceFirstFailure = now.getTime() - recordTime.getTime();
        const resetWindowMs = this.config.resetWindowMinutes * 60 * 1000;

        // Reset attempts if outside the reset window
        if (timeSinceFirstFailure > resetWindowMs) {
          failedAttempts = 1;
          firstFailureAt = now;
        } else {
          failedAttempts = record.failed_attempts + 1;
          firstFailureAt = recordTime;
        }
      }

      // Check if account should be locked
      const shouldLock = failedAttempts >= this.config.maxAttempts;
      const lockoutUntil = shouldLock
        ? new Date(
            now.getTime() + this.config.lockoutDurationMinutes * 60 * 1000,
          )
        : undefined;

      // Update or insert lockout record
      const lockoutData = {
        identifier,
        failed_attempts: failedAttempts,
        first_failure_at: firstFailureAt.toISOString(),
        locked_until: lockoutUntil?.toISOString(),
        last_failure_at: now.toISOString(),
      };

      let error;
      if (existingRecord) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('account_lockouts')
          .update(lockoutData)
          .eq('identifier', identifier);
        error = updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('account_lockouts')
          .insert(lockoutData);
        error = insertError;
      }

      if (error) {
        this.logger.error('Failed to record lockout attempt', {
          errorMessage: error instanceof Error ? error.message : String(error),
          identifier,
          existingRecord: !!existingRecord,
          failedAttempts,
        });

        // Don't throw on lockout errors - just log and continue
        // This prevents login attempts from failing due to lockout tracking issues
        this.logger.warn(
          `Lockout tracking failed for ${identifier}, continuing without lockout protection`,
        );

        return {
          isLocked: false,
          remainingAttempts: this.config.maxAttempts,
          totalFailedAttempts: 0,
        };
      }

      const status: AccountLockoutStatus = {
        isLocked: shouldLock,
        remainingAttempts: Math.max(
          0,
          this.config.maxAttempts - failedAttempts,
        ),
        lockoutUntil,
        totalFailedAttempts: failedAttempts,
      };

      if (shouldLock) {
        this.logger.warn(`Account locked for identifier: ${identifier}`, {
          attempts: failedAttempts,
          lockoutUntil: lockoutUntil?.toISOString(),
        });
      } else {
        this.logger.log(
          `Failed login attempt recorded for: ${identifier} (${failedAttempts}/${this.config.maxAttempts})`,
        );
      }

      return status;
    } catch (error) {
      this.logger.error('Error in recordFailedAttempt', error);
      throw error;
    }
  }

  async checkLockoutStatus(identifier: string): Promise<AccountLockoutStatus> {
    const supabase = this.supabaseService.getClient();

    try {
      const { data: record } = await supabase
        .from('account_lockouts')
        .select('*')
        .eq('identifier', identifier)
        .maybeSingle<AccountLockout>(); // Use maybeSingle() to avoid error when no record exists

      if (!record) {
        return {
          isLocked: false,
          remainingAttempts: this.config.maxAttempts,
          totalFailedAttempts: 0,
        };
      }

      const lockoutRecord = record;
      const now = new Date();
      const lockedUntil = lockoutRecord.locked_until
        ? new Date(lockoutRecord.locked_until)
        : null;

      // Check if lockout has expired
      if (lockedUntil && now < lockedUntil) {
        return {
          isLocked: true,
          remainingAttempts: 0,
          lockoutUntil: lockedUntil,
          totalFailedAttempts: lockoutRecord.failed_attempts,
        };
      }

      // Check if we're in the reset window
      const firstFailureAt = new Date(lockoutRecord.first_failure_at);
      const timeSinceFirstFailure = now.getTime() - firstFailureAt.getTime();
      const resetWindowMs = this.config.resetWindowMinutes * 60 * 1000;

      if (timeSinceFirstFailure > resetWindowMs) {
        // Reset the record
        await this.resetLockout(identifier);
        return {
          isLocked: false,
          remainingAttempts: this.config.maxAttempts,
          totalFailedAttempts: 0,
        };
      }

      return {
        isLocked: false,
        remainingAttempts: Math.max(
          0,
          this.config.maxAttempts - lockoutRecord.failed_attempts,
        ),
        totalFailedAttempts: lockoutRecord.failed_attempts,
      };
    } catch (error) {
      this.logger.error('Error checking lockout status', error);
      // Return safe defaults on error
      return {
        isLocked: false,
        remainingAttempts: this.config.maxAttempts,
        totalFailedAttempts: 0,
      };
    }
  }

  async resetLockout(identifier: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    try {
      const { error } = await supabase
        .from('account_lockouts')
        .delete()
        .eq('identifier', identifier);

      if (error) {
        this.logger.error('Failed to reset lockout', error);
        throw new Error('Failed to reset lockout');
      }

      this.logger.log(`Lockout reset for identifier: ${identifier}`);
    } catch (error) {
      this.logger.error('Error in resetLockout', error);
      throw error;
    }
  }

  async clearExpiredLockouts(): Promise<number> {
    const supabase = this.supabaseService.getClient();

    try {
      const now = new Date();

      // Clear records where lockout has expired and reset window has passed
      const resetWindowMs = this.config.resetWindowMinutes * 60 * 1000;
      const cutoffTime = new Date(now.getTime() - resetWindowMs);

      const { data: expiredRecords, error: selectError } = await supabase
        .from('account_lockouts')
        .select('identifier')
        .or(
          `locked_until.lt.${now.toISOString()},first_failure_at.lt.${cutoffTime.toISOString()}`,
        );

      if (selectError) {
        throw selectError;
      }

      if (!expiredRecords || expiredRecords.length === 0) {
        return 0;
      }

      const { error: deleteError } = await supabase
        .from('account_lockouts')
        .delete()
        .or(
          `locked_until.lt.${now.toISOString()},first_failure_at.lt.${cutoffTime.toISOString()}`,
        );

      if (deleteError) {
        throw deleteError;
      }

      this.logger.log(
        `Cleared ${expiredRecords.length} expired lockout records`,
      );
      return expiredRecords.length;
    } catch (error) {
      this.logger.error('Error clearing expired lockouts', error);
      return 0;
    }
  }

  getLockoutConfig(): LockoutConfig {
    return { ...this.config };
  }

  async lockAccount(
    email: string,
    reason: string = 'Admin action',
  ): Promise<void> {
    const client = this.supabaseService.getServiceClient();

    try {
      this.logger.log(`Locking account for ${email}. Reason: ${reason}`);

      // Check if lockout entry exists
      const { data: existingLockout } = await client
        .from('account_lockouts')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      const lockUntil = new Date();
      lockUntil.setFullYear(lockUntil.getFullYear() + 100); // Lock for 100 years (effectively permanent)

      if (existingLockout) {
        // Update existing lockout
        const { error: updateError } = await client
          .from('account_lockouts')
          .update({
            lock_until: lockUntil.toISOString(),
            attempt_count: 999, // High number to indicate manual lock
            last_attempt_at: new Date().toISOString(),
            is_permanently_locked: true,
            lock_reason: reason,
            updated_at: new Date().toISOString(),
          })
          .eq('email', email.toLowerCase());

        if (updateError) {
          throw new Error(`Failed to update lockout: ${updateError.message}`);
        }
      } else {
        // Create new lockout entry
        const { error: insertError } = await client
          .from('account_lockouts')
          .insert({
            email: email.toLowerCase(),
            attempt_count: 999,
            lock_until: lockUntil.toISOString(),
            last_attempt_at: new Date().toISOString(),
            is_permanently_locked: true,
            lock_reason: reason,
          });

        if (insertError) {
          throw new Error(`Failed to create lockout: ${insertError.message}`);
        }
      }

      // Revoke all active sessions for this user
      await this.revokeAllUserSessions(email);

      // Log security event
      await this.logSecurityEvent(email, 'account_locked', {
        reason,
        lockedBy: 'admin',
        lockUntil: lockUntil.toISOString(),
      });

      this.logger.log(`Successfully locked account for ${email}`);
    } catch (error) {
      this.logger.error(`Error locking account for ${email}:`, error);
      throw error;
    }
  }

  /**
   * Unlock an account (Admin action)
   */
  async unlockAccount(email: string): Promise<void> {
    const client = this.supabaseService.getServiceClient();

    try {
      this.logger.log(`Unlocking account for ${email}`);

      // Remove or update lockout entry
      const { error: deleteError } = await client
        .from('account_lockouts')
        .delete()
        .eq('email', email.toLowerCase());

      if (deleteError) {
        this.logger.warn(
          `Failed to delete lockout entry for ${email}: ${deleteError.message}`,
        );
      }

      // Log security event
      await this.logSecurityEvent(email, 'account_unlocked', {
        unlockedBy: 'admin',
        unlockedAt: new Date().toISOString(),
      });

      this.logger.log(`Successfully unlocked account for ${email}`);
    } catch (error) {
      this.logger.error(`Error unlocking account for ${email}:`, error);
      throw error;
    }
  }

  /**
   * Revoke all active sessions for a user
   */
  private async revokeAllUserSessions(email: string): Promise<void> {
    const client = this.supabaseService.getServiceClient();

    try {
      // Get user profile
      const { data: profile } = await client
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      if (!profile) {
        this.logger.warn(`No profile found for ${email}`);
        return;
      }

      // Delete all user sessions
      const { error: sessionError } = await client
        .from('user_sessions')
        .delete()
        .eq('user_id', profile.id);

      if (sessionError) {
        this.logger.error(
          `Failed to delete sessions for ${email}:`,
          sessionError,
        );
      }

      // Revoke all refresh tokens
      const { error: tokenError } = await client
        .from('refresh_tokens')
        .update({ is_revoked: true })
        .eq('user_id', profile.id);

      if (tokenError) {
        this.logger.error(
          `Failed to revoke refresh tokens for ${email}:`,
          tokenError,
        );
      }

      this.logger.log(`Revoked all sessions for ${email}`);
    } catch (error) {
      this.logger.error(`Error revoking sessions for ${email}:`, error);
    }
  }

  /**
   * Log security events
   */
  private async logSecurityEvent(
    email: string,
    eventType: string,
    metadata: any = {},
  ): Promise<void> {
    const client = this.supabaseService.getServiceClient();

    try {
      await client.from('security_events').insert({
        email: email.toLowerCase(),
        event_type: eventType,
        metadata,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to log security event:', error);
      // Don't throw - logging failure shouldn't break the operation
    }
  }

  /**
   * Get lockout status for a user
   */
  async getLockoutStatus(email: string): Promise<{
    isLocked: boolean;
    lockUntil?: Date;
    attemptCount: number;
    isPermanent: boolean;
    lockReason?: string;
  }> {
    const client = this.supabaseService.getServiceClient();

    try {
      const { data: lockout } = await client
        .from('account_lockouts')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (!lockout) {
        return {
          isLocked: false,
          attemptCount: 0,
          isPermanent: false,
        };
      }

      const lockUntil = new Date(lockout.lock_until);
      const isLocked = lockUntil > new Date();

      return {
        isLocked: isLocked || lockout.is_permanently_locked,
        lockUntil: isLocked ? lockUntil : undefined,
        attemptCount: lockout.attempt_count || 0,
        isPermanent: lockout.is_permanently_locked || false,
        lockReason: lockout.lock_reason,
      };
    } catch (error) {
      this.logger.error(`Error getting lockout status for ${email}:`, error);
      return {
        isLocked: false,
        attemptCount: 0,
        isPermanent: false,
      };
    }
  }

  /**
   * Get all locked accounts (for admin panel)
   */
  async getAllLockedAccounts(): Promise<
    Array<{
      email: string;
      lockUntil: Date;
      attemptCount: number;
      isPermanent: boolean;
      lockReason?: string;
      lastAttempt: Date;
    }>
  > {
    const client = this.supabaseService.getServiceClient();

    try {
      const { data: lockouts, error } = await client
        .from('account_lockouts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch locked accounts: ${error.message}`);
      }

      return (lockouts || []).map((lockout) => ({
        email: lockout.email,
        lockUntil: new Date(lockout.lock_until),
        attemptCount: lockout.attempt_count || 0,
        isPermanent: lockout.is_permanently_locked || false,
        lockReason: lockout.lock_reason,
        lastAttempt: new Date(lockout.last_attempt_at),
      }));
    } catch (error) {
      this.logger.error('Error fetching locked accounts:', error);
      return [];
    }
  }
}
