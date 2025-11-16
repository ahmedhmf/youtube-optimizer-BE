import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccountLockoutService } from './account-lockout.service';

@Injectable()
export class LockoutCleanupService {
  private readonly logger = new Logger(LockoutCleanupService.name);

  constructor(
    private readonly accountLockoutService: AccountLockoutService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCleanupExpiredLockouts() {
    this.logger.log('Starting cleanup of expired account lockouts');
    
    try {
      const cleanedCount = await this.accountLockoutService.clearExpiredLockouts();
      
      if (cleanedCount > 0) {
        this.logger.log(`Cleanup completed: ${cleanedCount} expired lockout records removed`);
      } else {
        this.logger.log('Cleanup completed: no expired records found');
      }
    } catch (error) {
      this.logger.error('Error during lockout cleanup', error);
    }
  }

  // Manual cleanup method for admin use
  async manualCleanup(): Promise<number> {
    this.logger.log('Manual cleanup of expired account lockouts triggered');
    
    try {
      const cleanedCount = await this.accountLockoutService.clearExpiredLockouts();
      this.logger.log(`Manual cleanup completed: ${cleanedCount} records removed`);
      return cleanedCount;
    } catch (error) {
      this.logger.error('Error during manual lockout cleanup', error);
      throw error;
    }
  }
}