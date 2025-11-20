import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PasswordBreachService } from '../common/password-breach.service';
import { PasswordSecurityService } from '../common/password-security.service';
import { AuditLoggingService } from '../common/audit-logging.service';
import { AuditEventType } from '../common/types/audit-event.type';
import { AuditEventCategory } from '../common/types/audit-event-category.type';
import { AuditSeverity } from '../common/types/audit-severity.type';
import { AuditStatus } from '../common/types/audit-status.type';

class PasswordCheckDto {
  password: string;
}

class MultiplePasswordCheckDto {
  passwords: string[];
}

interface PasswordCheckResponse {
  isBreached: boolean;
  breachCount: number | null;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  strengthAnalysis: {
    length: number;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumbers: boolean;
    hasSpecialChars: boolean;
    entropy: number;
    strengthScore: number;
  };
  recommendation: string;
  isAllowedForRegistration: boolean;
  warningMessage?: string;
}

@Controller('password-security')
export class PasswordSecurityController {
  constructor(
    private readonly passwordBreachService: PasswordBreachService,
    private readonly passwordSecurityService: PasswordSecurityService,
    private readonly auditLoggingService: AuditLoggingService,
  ) {}

  /**
   * Check if a password has been compromised in data breaches
   */
  @Post('check')
  @UseGuards(JwtAuthGuard)
  async checkPassword(
    @Body(ValidationPipe) dto: PasswordCheckDto,
    @Req() req: Request,
  ): Promise<PasswordCheckResponse> {
    const userId = (req.user as { id: string })?.id;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    if (!dto.password || dto.password.trim().length === 0) {
      throw new BadRequestException('Password is required');
    }

    try {
      // Get comprehensive security analysis
      const analysisResult =
        await this.passwordBreachService.analyzePasswordSecurity(dto.password);

      // Get security check for registration context
      const securityCheck =
        await this.passwordSecurityService.checkPasswordSecurity(
          dto.password,
          'registration',
          userId,
          ipAddress,
          userAgent,
        );

      // Generate recommendation based on results
      let recommendation = '';
      if (analysisResult.breachResult.riskLevel === 'critical') {
        recommendation =
          '🚨 This password is extremely unsafe. It has appeared in numerous data breaches. Choose a completely different password immediately.';
      } else if (analysisResult.breachResult.riskLevel === 'high') {
        recommendation =
          '⚠️ This password is unsafe. It has been found in multiple data breaches. Please choose a different password.';
      } else if (analysisResult.breachResult.riskLevel === 'medium') {
        recommendation =
          '⚠️ This password has some security concerns. It has been found in data breaches. Consider using a more unique password.';
      } else if (analysisResult.breachResult.isBreached) {
        recommendation =
          'ℹ️ This password has been found in a small number of breaches. For better security, consider using a unique password.';
      } else {
        recommendation =
          '✅ This password has not been found in known data breaches. Good choice!';
      }

      // Add strength-based recommendations
      if (analysisResult.strengthAnalysis.strengthScore < 3) {
        recommendation +=
          ' Additionally, consider making your password longer and including a mix of uppercase, lowercase, numbers, and symbols.';
      }

      return {
        isBreached: analysisResult.breachResult.isBreached,
        breachCount: analysisResult.breachResult.breachCount ?? null,
        riskLevel: analysisResult.breachResult.riskLevel,
        strengthAnalysis: analysisResult.strengthAnalysis,
        recommendation: analysisResult.overallRecommendation || recommendation,
        isAllowedForRegistration: securityCheck.isAllowed,
        warningMessage: securityCheck.warningMessage,
      };
    } catch (error) {
      // Log the error but don't expose it to the user
      await this.auditLoggingService.logEvent({
        userId: userId,
        eventType: AuditEventType.API_ACCESS,
        eventCategory: AuditEventCategory.SECURITY,
        severity: AuditSeverity.HIGH,
        status: AuditStatus.FAILURE,
        ipAddress,
        userAgent,
        resourceType: 'password',
        action: 'breach_check',
        metadata: {
          error: (error as Error).message,
          context: 'password_security_check',
        },
      });

      throw new BadRequestException(
        'Unable to check password security at this time. Please try again later.',
      );
    }
  }

  /**
   * Check multiple passwords for breaches (batch processing)
   */
  @Post('check-multiple')
  @UseGuards(JwtAuthGuard)
  async checkMultiplePasswords(
    @Body(ValidationPipe) dto: MultiplePasswordCheckDto,
    @Req() req: Request,
  ): Promise<{ results: PasswordCheckResponse[] }> {
    const userId = (req.user as { id: string })?.id;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    if (!dto.passwords || !Array.isArray(dto.passwords)) {
      throw new BadRequestException('Passwords array is required');
    }

    if (dto.passwords.length === 0) {
      throw new BadRequestException('At least one password is required');
    }

    if (dto.passwords.length > 10) {
      throw new BadRequestException('Maximum 10 passwords allowed per request');
    }

    try {
      // Check all passwords in batch
      const breachResults =
        await this.passwordBreachService.checkMultiplePasswords(dto.passwords);

      const results: PasswordCheckResponse[] = [];

      for (const password of dto.passwords) {
        const breachResult = breachResults.get(password);
        if (!breachResult) {
          continue; // Skip if no result found
        }

        // Get comprehensive analysis
        const analysisResult =
          await this.passwordBreachService.analyzePasswordSecurity(password);

        // Get security check for each password
        const securityCheck =
          await this.passwordSecurityService.checkPasswordSecurity(
            password,
            'registration',
            userId,
            ipAddress,
            userAgent,
          );

        let recommendation = '';
        if (breachResult.riskLevel === 'critical') {
          recommendation = '🚨 Extremely unsafe - found in numerous breaches';
        } else if (breachResult.riskLevel === 'high') {
          recommendation = '⚠️ Unsafe - found in multiple breaches';
        } else if (breachResult.riskLevel === 'medium') {
          recommendation = '⚠️ Some concerns - found in breaches';
        } else if (breachResult.isBreached) {
          recommendation = 'ℹ️ Found in small number of breaches';
        } else {
          recommendation = '✅ Not found in known breaches';
        }

        results.push({
          isBreached: breachResult.isBreached,
          breachCount: breachResult.breachCount ?? null,
          riskLevel: breachResult.riskLevel,
          strengthAnalysis: analysisResult.strengthAnalysis,
          recommendation:
            analysisResult.overallRecommendation || recommendation,
          isAllowedForRegistration: securityCheck.isAllowed,
          warningMessage: securityCheck.warningMessage,
        });
      }

      // Log the batch check
      await this.auditLoggingService.logEvent({
        userId: userId,
        eventType: AuditEventType.DATA_ACCESS,
        eventCategory: AuditEventCategory.SECURITY,
        severity: AuditSeverity.LOW,
        status: AuditStatus.SUCCESS,
        ipAddress,
        userAgent,
        resourceType: 'password',
        action: 'batch_breach_check',
        metadata: {
          passwordCount: dto.passwords.length,
          breachedCount: results.filter((r) => r.isBreached).length,
        },
      });

      return { results };
    } catch (error) {
      // Log the error
      await this.auditLoggingService.logEvent({
        userId: userId,
        eventType: AuditEventType.API_ACCESS,
        eventCategory: AuditEventCategory.SECURITY,
        severity: AuditSeverity.HIGH,
        status: AuditStatus.FAILURE,
        ipAddress,
        userAgent,
        resourceType: 'password',
        action: 'batch_breach_check',
        metadata: {
          error: (error as Error).message,
          passwordCount: dto.passwords?.length || 0,
        },
      });

      throw new BadRequestException(
        'Unable to check password security at this time. Please try again later.',
      );
    }
  }

  /**
   * Get security recommendations for password creation
   */
  @Post('recommendations')
  @UseGuards(JwtAuthGuard)
  getPasswordRecommendations(): {
    recommendations: string[];
    bestPractices: string[];
    commonMistakes: string[];
  } {
    return {
      recommendations: [
        'Use at least 12 characters for better security',
        'Include a mix of uppercase and lowercase letters',
        'Add numbers and special symbols (!@#$%^&*)',
        'Avoid common words, names, and dictionary terms',
        "Don't use personal information (birthdays, addresses, etc.)",
        'Use unique passwords for each account',
        'Consider using a passphrase with random words',
        'Use a password manager to generate and store passwords',
      ],
      bestPractices: [
        'Enable two-factor authentication when possible',
        'Regularly update passwords for important accounts',
        'Never share passwords or write them down insecurely',
        'Use different passwords for work and personal accounts',
        'Check if your passwords have been breached regularly',
        'Log out of accounts when using shared computers',
      ],
      commonMistakes: [
        'Using the same password everywhere',
        'Adding just numbers to the end (password123)',
        'Using keyboard patterns (qwerty, 123456)',
        "Including personal information that's publicly available",
        'Making passwords too short (less than 8 characters)',
        'Using only lowercase letters',
        "Trusting password strength meters that don't check breaches",
      ],
    };
  }
}
