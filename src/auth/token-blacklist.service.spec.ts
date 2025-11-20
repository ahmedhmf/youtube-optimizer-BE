import { Test, TestingModule } from '@nestjs/testing';
import {
  TokenBlacklistService,
  BlacklistReason,
} from './token-blacklist.service';
import { SupabaseService } from '../supabase/supabase.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('TokenBlacklistService', () => {
  let service: TokenBlacklistService;
  let supabaseService: SupabaseService;
  let jwtService: JwtService;

  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
  };

  const mockSupabaseService = {
    getClient: jest.fn(() => mockSupabaseClient),
  };

  const mockJwtService = {
    decode: jest.fn(),
    sign: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenBlacklistService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TokenBlacklistService>(TokenBlacklistService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('blacklistToken', () => {
    const mockToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyNDkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const mockUserId = 'user-123';

    beforeEach(() => {
      // Mock JWT decode to return expiration time
      mockJwtService.decode.mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        sub: mockUserId,
      });

      // Mock successful database insert
      mockSupabaseClient.insert.mockResolvedValue({
        data: null,
        error: null,
      });
    });

    it('should blacklist a token successfully', async () => {
      await service.blacklistToken(
        mockToken,
        mockUserId,
        BlacklistReason.LOGOUT,
      );

      expect(mockJwtService.decode).toHaveBeenCalledWith(mockToken);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'blacklisted_tokens',
      );
      expect(mockSupabaseClient.insert).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockSupabaseClient.insert.mockResolvedValue({
        error: { message: 'Database error' },
      });

      await expect(
        service.blacklistToken(mockToken, mockUserId, BlacklistReason.LOGOUT),
      ).rejects.toThrow('Failed to blacklist token');
    });
  });

  describe('isTokenBlacklisted', () => {
    const mockToken = 'test-token';

    it('should return false for non-blacklisted token', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }, // No rows found
      });

      const result = await service.isTokenBlacklisted(mockToken);

      expect(result).toBe(false);
    });

    it('should return true for blacklisted token', async () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
      mockSupabaseClient.single.mockResolvedValue({
        data: { expires_at: futureDate.toISOString() },
        error: null,
      });

      const result = await service.isTokenBlacklisted(mockToken);

      expect(result).toBe(true);
    });

    it('should return false for expired blacklisted token', async () => {
      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
      mockSupabaseClient.single.mockResolvedValue({
        data: { expires_at: pastDate.toISOString() },
        error: null,
      });

      const result = await service.isTokenBlacklisted(mockToken);

      expect(result).toBe(false);
    });

    it('should fail open on database errors', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Database connection error' },
      });

      const result = await service.isTokenBlacklisted(mockToken);

      expect(result).toBe(false); // Should fail open for availability
    });
  });

  describe('blacklistAllUserTokens', () => {
    const mockUserId = 'user-123';

    it('should increment user token version', async () => {
      // Mock getting current token version
      mockSupabaseClient.single.mockResolvedValue({
        data: { token_version: 5 },
        error: null,
      });

      // Mock successful update
      mockSupabaseClient.update.mockResolvedValue({
        error: null,
      });

      await service.blacklistAllUserTokens(
        mockUserId,
        BlacklistReason.PASSWORD_CHANGE,
      );

      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        token_version: 6,
        updated_at: expect.any(String),
      });
    });
  });

  describe('getBlacklistStats', () => {
    it('should return statistics about blacklisted tokens', async () => {
      const mockTokens = [
        {
          reason: BlacklistReason.LOGOUT,
          created_at: new Date().toISOString(),
        },
        {
          reason: BlacklistReason.PASSWORD_CHANGE,
          created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
        },
      ];

      mockSupabaseClient.select.mockResolvedValue({
        data: mockTokens,
        error: null,
      });

      const stats = await service.getBlacklistStats();

      expect(stats.totalBlacklisted).toBe(2);
      expect(stats.byReason).toEqual({
        [BlacklistReason.LOGOUT]: 1,
        [BlacklistReason.PASSWORD_CHANGE]: 1,
      });
      expect(stats.recentActivity).toBe(1); // Only one in last 24 hours
    });

    it('should handle empty results', async () => {
      mockSupabaseClient.select.mockResolvedValue({
        data: [],
        error: null,
      });

      const stats = await service.getBlacklistStats();

      expect(stats.totalBlacklisted).toBe(0);
      expect(stats.byReason).toEqual({});
      expect(stats.recentActivity).toBe(0);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens from database', async () => {
      mockSupabaseClient.delete.mockResolvedValue({
        error: null,
      });

      await service.cleanupExpiredTokens();

      expect(mockSupabaseClient.delete).toHaveBeenCalled();
      expect(mockSupabaseClient.lt).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      mockSupabaseClient.delete.mockResolvedValue({
        error: { message: 'Cleanup failed' },
      });

      // Should not throw error
      await expect(service.cleanupExpiredTokens()).resolves.toBeUndefined();
    });
  });

  describe('isUserTokenVersionValid', () => {
    const mockUserId = 'user-123';
    const tokenIssuedAt = Math.floor(Date.now() / 1000);

    it('should return true for valid token version', async () => {
      // Token issued after user update
      const userUpdatedAt = new Date(Date.now() - 3600000); // 1 hour ago

      mockSupabaseClient.single.mockResolvedValue({
        data: {
          token_version: 1,
          updated_at: userUpdatedAt.toISOString(),
        },
        error: null,
      });

      const result = await service.isUserTokenVersionValid(
        mockUserId,
        tokenIssuedAt,
      );

      expect(result).toBe(true);
    });

    it('should return false for invalid token version', async () => {
      // Token issued before user update
      const userUpdatedAt = new Date(Date.now() + 3600000); // 1 hour from now

      mockSupabaseClient.single.mockResolvedValue({
        data: {
          token_version: 2,
          updated_at: userUpdatedAt.toISOString(),
        },
        error: null,
      });

      const result = await service.isUserTokenVersionValid(
        mockUserId,
        tokenIssuedAt,
      );

      expect(result).toBe(false);
    });

    it('should fail open when user not found', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await service.isUserTokenVersionValid(
        mockUserId,
        tokenIssuedAt,
      );

      expect(result).toBe(true); // Fail open
    });
  });
});
