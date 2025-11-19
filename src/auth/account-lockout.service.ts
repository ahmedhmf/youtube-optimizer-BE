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
}
