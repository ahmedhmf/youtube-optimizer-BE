import { Injectable, BadRequestException } from '@nestjs/common';
import {
  PasswordBreachService,
  PasswordBreachResult,
} from './password-breach.service';
import { AuditLoggingService } from './audit-logging.service';
import { AuditEventType } from './types/audit-event.type';
import { AuditEventCategory } from './types/audit-event-category.type';
import { AuditStatus } from './types/audit-status.type';
import { AuditSeverity } from './types/audit-severity.type';

export interface PasswordSecurityCheck {
  isAllowed: boolean;
  requiresWarning: boolean;
  warningMessage?: string;
  blockingMessage?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  breachResult: PasswordBreachResult;
}

@Injectable()
export class PasswordSecurityService {
  constructor(
    private readonly passwordBreachService: PasswordBreachService,
    private readonly auditLoggingService: AuditLoggingService,
  ) {}

  /**
   * Check password security and determine if it should be allowed
   */
  async checkPasswordSecurity(
    password: string,
    context: 'registration' | 'password_change' | 'login',
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PasswordSecurityCheck> {
    const breachResult =
      await this.passwordBreachService.checkPasswordBreach(password);

    let isAllowed = true;
    let requiresWarning = false;
    let warningMessage: string | undefined;
    let blockingMessage: string | undefined;

    // Risk-based decision logic
    switch (breachResult.riskLevel) {
      case 'critical':
        isAllowed = false;
        blockingMessage = `🚨 Password Compromised: This password has appeared in ${breachResult.breachCount?.toLocaleString()} data breaches and is extremely unsafe. Please choose a different password.`;
        break;

      case 'high':
        // For registration/password changes: BLOCK
        // For login: Allow but force password change
        if (context === 'login') {
          isAllowed = true;
          requiresWarning = true;
          warningMessage = `⚠️ Security Alert: Your password has been found in ${breachResult.breachCount?.toLocaleString()} data breaches. Please change it immediately after logging in.`;
        } else {
          isAllowed = false;
          blockingMessage = `⚠️ Password Compromised: This password has appeared in ${breachResult.breachCount?.toLocaleString()} data breaches. Please choose a more secure password.`;
        }
        break;

      case 'medium':
        requiresWarning = true;
        warningMessage = `⚠️ Password Warning: This password has been found in ${breachResult.breachCount?.toLocaleString()} data breaches. We strongly recommend choosing a different password for better security.`;
        break;

      case 'low':
        if (breachResult.isBreached) {
          requiresWarning = true;
          warningMessage = `ℹ️ Security Notice: This password has been found in a small number of data breaches (${breachResult.breachCount}). Consider using a unique password for better security.`;
        }
        break;
    }

    // Log the security check
    if (userId) {
      await this.auditLoggingService.logEvent({
        userId,
        eventType: AuditEventType.DATA_ACCESS,
        eventCategory: AuditEventCategory.SECURITY,
        severity: this.getSeverityFromRisk(breachResult.riskLevel),
        status: isAllowed ? AuditStatus.SUCCESS : AuditStatus.FAILURE,
        ipAddress,
        userAgent,
        resourceType: 'password',
        action: 'breach_check',
        metadata: {
          context,
          isBreached: breachResult.isBreached,
          breachCount: breachResult.breachCount,
          riskLevel: breachResult.riskLevel,
          actionTaken: isAllowed ? 'allowed' : 'blocked',
          hasWarning: requiresWarning,
        },
      });
    }

    return {
      isAllowed,
      requiresWarning,
      warningMessage,
      blockingMessage,
      riskLevel: breachResult.riskLevel,
      breachResult,
    };
  }

  /**
   * Validate password for registration - stricter rules
   */
  async validateRegistrationPassword(
    password: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const securityCheck = await this.checkPasswordSecurity(
      password,
      'registration',
      userId,
      ipAddress,
      userAgent,
    );

    if (!securityCheck.isAllowed) {
      throw new BadRequestException(securityCheck.blockingMessage);
    }

    // For registration, we can also warn about medium risk passwords
    if (securityCheck.requiresWarning && securityCheck.riskLevel === 'medium') {
      throw new BadRequestException(
        `${securityCheck.warningMessage} Please choose a different password for your new account.`,
      );
    }
  }

  /**
   * Validate password for password change - strict but allow current users
   */
  async validatePasswordChange(
    password: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ warning?: string }> {
    const securityCheck = await this.checkPasswordSecurity(
      password,
      'password_change',
      userId,
      ipAddress,
      userAgent,
    );

    if (!securityCheck.isAllowed) {
      throw new BadRequestException(securityCheck.blockingMessage);
    }

    // Return warning for medium risk passwords but allow the change
    return {
      warning: securityCheck.warningMessage,
    };
  }

  /**
   * Check password during login - most lenient but provide warnings
   */
  async checkLoginPassword(
    password: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ shouldForcePasswordChange: boolean; warning?: string }> {
    const securityCheck = await this.checkPasswordSecurity(
      password,
      'login',
      userId,
      ipAddress,
      userAgent,
    );

    return {
      shouldForcePasswordChange:
        securityCheck.riskLevel === 'high' ||
        securityCheck.riskLevel === 'critical',
      warning: securityCheck.warningMessage,
    };
  }

  private getSeverityFromRisk(riskLevel: string): AuditSeverity {
    switch (riskLevel) {
      case 'critical':
        return AuditSeverity.CRITICAL;
      case 'high':
        return AuditSeverity.HIGH;
      case 'medium':
        return AuditSeverity.MEDIUM;
      default:
        return AuditSeverity.LOW;
    }
  }
}
