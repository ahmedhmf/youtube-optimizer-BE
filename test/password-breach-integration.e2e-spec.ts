import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PasswordBreachService } from '../src/common/password-breach.service';
import { PasswordSecurityService } from '../src/common/password-security.service';
import { AuditLoggingService } from '../src/common/audit-logging.service';
import { SupabaseModule } from '../src/supabase/supabase.module';

describe('Password Breach Checking Integration', () => {
  let passwordBreachService: PasswordBreachService;
  let passwordSecurityService: PasswordSecurityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(), SupabaseModule],
      providers: [
        PasswordBreachService,
        PasswordSecurityService,
        {
          provide: AuditLoggingService,
          useValue: {
            logEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    passwordBreachService = module.get<PasswordBreachService>(
      PasswordBreachService,
    );
    passwordSecurityService = module.get<PasswordSecurityService>(
      PasswordSecurityService,
    );
  });

  describe('Password Breach Detection', () => {
    it('should detect a commonly breached password', async () => {
      const result =
        await passwordBreachService.checkPasswordBreach('password123');

      expect(result.isBreached).toBe(true);
      expect(result.riskLevel).toBe('critical');
      expect(result.breachCount).toBeGreaterThan(100000);
    });

    it('should analyze password security comprehensively', async () => {
      const analysis =
        await passwordBreachService.analyzePasswordSecurity(
          'MyStr0ngP@ssw0rd!',
        );

      expect(analysis.breachResult).toBeDefined();
      expect(analysis.strengthAnalysis).toBeDefined();
      expect(analysis.strengthAnalysis.hasUppercase).toBe(true);
      expect(analysis.strengthAnalysis.hasLowercase).toBe(true);
      expect(analysis.strengthAnalysis.hasNumbers).toBe(true);
      expect(analysis.strengthAnalysis.hasSpecialChars).toBe(true);
      expect(analysis.overallRecommendation).toBeDefined();
    });

    it('should handle safe passwords correctly', async () => {
      // Generate a unique password that shouldn't be breached
      const uniquePassword = `MyUniquePass${Date.now()}!@#$`;

      const result =
        await passwordBreachService.checkPasswordBreach(uniquePassword);

      expect(result.isBreached).toBe(false);
      expect(result.riskLevel).toBe('low');
      expect(result.breachCount).toBeUndefined();
    });
  });

  describe('Password Security Workflow', () => {
    it('should block registration with critically breached password', async () => {
      await expect(
        passwordSecurityService.validateRegistrationPassword(
          'password123',
          'test-user',
        ),
      ).rejects.toThrow();
    });

    it('should allow registration with strong unique password', async () => {
      const uniquePassword = `MyStr0ng${Date.now()}P@ss!`;

      await expect(
        passwordSecurityService.validateRegistrationPassword(
          uniquePassword,
          'test-user',
        ),
      ).resolves.not.toThrow();
    });

    it('should provide appropriate login warnings for breached passwords', async () => {
      const result = await passwordSecurityService.checkLoginPassword(
        'password123',
        'test-user',
      );

      expect(result.shouldForcePasswordChange).toBe(true);
      expect(result.warning).toContain('data breaches');
    });
  });

  describe('Batch Password Checking', () => {
    it('should check multiple passwords efficiently', async () => {
      const passwords = [
        'password123',
        'MyStr0ngP@ssw0rd!',
        '123456',
        `UniquePass${Date.now()}!`,
      ];

      const results =
        await passwordBreachService.checkMultiplePasswords(passwords);

      expect(results.size).toBe(passwords.length);

      // Check that commonly breached passwords are detected
      expect(results.get('password123')?.isBreached).toBe(true);
      expect(results.get('123456')?.isBreached).toBe(true);
    });
  });
});
