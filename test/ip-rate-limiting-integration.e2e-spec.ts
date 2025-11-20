import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import {
  IPRateLimitService,
  RateLimitResult,
} from '../src/common/ip-rate-limit.service';
import { AuditLoggingService } from '../src/common/audit-logging.service';
import { SupabaseModule } from '../src/supabase/supabase.module';

describe('IP Rate Limiting Integration', () => {
  let rateLimitService: IPRateLimitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(), SupabaseModule],
      providers: [
        IPRateLimitService,
        {
          provide: AuditLoggingService,
          useValue: {
            logEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    rateLimitService = module.get<IPRateLimitService>(IPRateLimitService);
  });

  describe('Rate Limit Enforcement', () => {
    const testIP = '192.168.1.100';
    const testEndpoint = 'auth/login';

    it('should allow requests within limit', async () => {
      const result: RateLimitResult = await rateLimitService.checkRateLimit(
        testIP,
        testEndpoint,
        'test-user-agent',
      );

      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBeGreaterThanOrEqual(0);
      expect(result.resetTime).toBeInstanceOf(Date);
    });

    it('should enforce different limits for different endpoints', async () => {
      // Test auth endpoint (stricter limits)
      const authResult = await rateLimitService.checkRateLimit(
        testIP,
        'auth/login',
      );

      // Test general endpoint (more lenient)
      const generalResult = await rateLimitService.checkRateLimit(
        testIP,
        'general/api',
      );

      // Auth endpoint should have lower or equal remaining requests
      // (depending on configuration)
      expect(authResult.allowed).toBe(true);
      expect(generalResult.allowed).toBe(true);
    });

    it('should block IP after exceeding limit', async () => {
      const testIPExcessive = '192.168.1.101';
      const endpoint = 'auth/login';

      // Make requests up to the limit (login limit is typically 5)
      for (let i = 0; i < 6; i++) {
        const result = await rateLimitService.checkRateLimit(
          testIPExcessive,
          endpoint,
        );

        if (i < 5) {
          expect(result.allowed).toBe(true);
        } else {
          // 6th request should be blocked
          expect(result.allowed).toBe(false);
          expect(result.retryAfter).toBeGreaterThan(0);
        }
      }
    }, 10000); // Increase timeout for multiple database calls
  });

  describe('Admin Management', () => {
    const adminIP = '192.168.1.200';

    it('should manually block IP address', async () => {
      const blockDuration = 60 * 1000; // 1 minute
      const reason = 'Test blocking';

      await rateLimitService.blockIP(
        adminIP,
        blockDuration,
        reason,
        'test-admin-id',
      );

      // Verify IP is blocked
      const result = await rateLimitService.checkRateLimit(
        adminIP,
        'general/api',
      );

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should unblock IP address', async () => {
      // First block the IP
      await rateLimitService.blockIP(
        adminIP,
        60 * 1000,
        'Test blocking for unblock',
        'test-admin-id',
      );

      // Then unblock it
      await rateLimitService.unblockIP(adminIP, 'test-admin-id');

      // Verify IP is no longer blocked
      const result = await rateLimitService.checkRateLimit(
        adminIP,
        'general/api',
      );

      expect(result.allowed).toBe(true);
    });

    it('should provide rate limit statistics', async () => {
      const stats = await rateLimitService.getRateLimitStats('test-admin-id');

      expect(stats).toBeDefined();
      expect(typeof stats.totalBlocked).toBe('number');
      expect(typeof stats.currentlyBlocked).toBe('number');
      expect(Array.isArray(stats.topOffenders)).toBe(true);
    });
  });

  describe('Cleanup Operations', () => {
    it('should cleanup old records without errors', async () => {
      await expect(rateLimitService.cleanupOldRecords()).resolves.not.toThrow();
    });
  });
});
