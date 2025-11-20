import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface PasswordBreachResult {
  isBreached: boolean;
  breachCount?: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

@Injectable()
export class PasswordBreachService {
  private readonly logger = new Logger(PasswordBreachService.name);
  private readonly hibpApiUrl = 'https://api.pwnedpasswords.com/range/';

  constructor(private readonly configService: ConfigService) {}

  /**
   * Check if password has been found in known data breaches
   * Uses k-anonymity to protect password privacy
   */
  async checkPasswordBreach(password: string): Promise<PasswordBreachResult> {
    try {
      // 1. Hash the password using SHA-1 (HIBP requirement)
      const hash = crypto
        .createHash('sha1')
        .update(password)
        .digest('hex')
        .toUpperCase();

      // 2. Use k-anonymity: send only first 5 characters
      const hashPrefix = hash.substring(0, 5);
      const hashSuffix = hash.substring(5);

      this.logger.debug(
        `Checking password breach for hash prefix: ${hashPrefix}`,
      );

      // 3. Query HIBP API with hash prefix only
      const response = await fetch(`${this.hibpApiUrl}${hashPrefix}`, {
        headers: {
          'User-Agent': 'YouTube-Optimizer-Security-Check',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        this.logger.warn(`HIBP API returned status: ${response.status}`);
        // Fail open - if API is down, don't block user
        return this.createSafeResult();
      }

      // 4. Parse response and check if our hash suffix is present
      const responseText = await response.text();
      const lines = responseText.split('\n');

      for (const line of lines) {
        const [suffix, count] = line.trim().split(':');
        if (suffix === hashSuffix) {
          const breachCount = parseInt(count, 10);
          return this.createBreachResult(breachCount);
        }
      }

      // Password not found in breaches
      return {
        isBreached: false,
        riskLevel: 'low',
        recommendation: 'Password not found in known data breaches.',
      };
    } catch (error) {
      this.logger.error('Error checking password breach:', error);
      // Fail open - don't block users if service is unavailable
      return this.createSafeResult();
    }
  }

  /**
   * Batch check multiple passwords (for admin security audits)
   */
  async checkMultiplePasswords(
    passwords: string[],
  ): Promise<Map<string, PasswordBreachResult>> {
    const results = new Map<string, PasswordBreachResult>();

    // Group by hash prefix to minimize API calls
    const prefixGroups = new Map<
      string,
      { password: string; hash: string; suffix: string }[]
    >();

    for (const password of passwords) {
      const hash = crypto
        .createHash('sha1')
        .update(password)
        .digest('hex')
        .toUpperCase();
      const prefix = hash.substring(0, 5);
      const suffix = hash.substring(5);

      if (!prefixGroups.has(prefix)) {
        prefixGroups.set(prefix, []);
      }

      prefixGroups.get(prefix)!.push({ password, hash, suffix });
    }

    // Process each prefix group
    for (const [prefix, group] of prefixGroups) {
      try {
        const response = await fetch(`${this.hibpApiUrl}${prefix}`, {
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const responseText = await response.text();
          const breaches = new Map<string, number>();

          responseText.split('\n').forEach((line) => {
            const [suffix, count] = line.trim().split(':');
            if (suffix && count) {
              breaches.set(suffix, parseInt(count, 10));
            }
          });

          // Check each password in this group
          for (const { password, suffix } of group) {
            const breachCount = breaches.get(suffix);
            results.set(
              password,
              breachCount
                ? this.createBreachResult(breachCount)
                : {
                    isBreached: false,
                    riskLevel: 'low',
                    recommendation: 'Password not breached.',
                  },
            );
          }
        } else {
          // API error - mark all as safe
          for (const { password } of group) {
            results.set(password, this.createSafeResult());
          }
        }
      } catch (error) {
        this.logger.error(`Error checking prefix ${prefix}:`, error);
        // Mark all passwords in this group as safe due to API error
        for (const { password } of group) {
          results.set(password, this.createSafeResult());
        }
      }

      // Rate limiting - small delay between requests
      await this.delay(100);
    }

    return results;
  }

  /**
   * Get security recommendations based on breach analysis
   */
  async analyzePasswordSecurity(password: string): Promise<{
    breachResult: PasswordBreachResult;
    strengthAnalysis: {
      length: number;
      hasUppercase: boolean;
      hasLowercase: boolean;
      hasNumbers: boolean;
      hasSpecialChars: boolean;
      entropy: number;
      strengthScore: number;
    };
    overallRecommendation: string;
  }> {
    const breachResult = await this.checkPasswordBreach(password);

    // Analyze password strength
    const strengthAnalysis = {
      length: password.length,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumbers: /\d/.test(password),
      hasSpecialChars: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
      entropy: this.calculateEntropy(password),
      strengthScore: this.calculateStrengthScore(password),
    };

    let overallRecommendation = '';

    if (breachResult.isBreached) {
      overallRecommendation = `🚨 CRITICAL: This password has been compromised ${breachResult.breachCount} times. Change immediately!`;
    } else if (strengthAnalysis.strengthScore < 3) {
      overallRecommendation =
        '⚠️ Consider using a stronger password with more complexity.';
    } else {
      overallRecommendation =
        '✅ Password appears secure and has not been breached.';
    }

    return {
      breachResult,
      strengthAnalysis,
      overallRecommendation,
    };
  }

  private createBreachResult(breachCount: number): PasswordBreachResult {
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    let recommendation: string;

    if (breachCount > 100000) {
      riskLevel = 'critical';
      recommendation = `🚨 CRITICAL: Password found ${breachCount.toLocaleString()} times in breaches. Change immediately!`;
    } else if (breachCount > 10000) {
      riskLevel = 'high';
      recommendation = `⚠️ HIGH RISK: Password found ${breachCount.toLocaleString()} times in breaches. Change soon.`;
    } else if (breachCount > 100) {
      riskLevel = 'medium';
      recommendation = `⚠️ MEDIUM RISK: Password found ${breachCount.toLocaleString()} times in breaches. Consider changing.`;
    } else {
      riskLevel = 'low';
      recommendation = `⚠️ LOW RISK: Password found ${breachCount} times in breaches. Consider changing.`;
    }

    return {
      isBreached: true,
      breachCount,
      riskLevel,
      recommendation,
    };
  }

  private createSafeResult(): PasswordBreachResult {
    return {
      isBreached: false,
      riskLevel: 'low',
      recommendation:
        'Unable to check breach status, but password appears acceptable.',
    };
  }

  private calculateEntropy(password: string): number {
    const charset = new Set(password);
    return Math.log2(charset.size) * password.length;
  }

  private calculateStrengthScore(password: string): number {
    let score = 0;

    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score++;

    return score;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
