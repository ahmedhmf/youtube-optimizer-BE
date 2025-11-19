import { Test, TestingModule } from '@nestjs/testing';
import { ValidationAndSanitizationPipe } from './validation-sanitization.pipe';
import { BadRequestException } from '@nestjs/common';
import { LoginDto } from '../auth/dto/login.dto';

describe('ValidationAndSanitizationPipe', () => {
  let pipe: ValidationAndSanitizationPipe;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidationAndSanitizationPipe],
    }).compile();

    pipe = module.get<ValidationAndSanitizationPipe>(
      ValidationAndSanitizationPipe,
    );
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should sanitize malicious input', async () => {
    const maliciousInput = {
      email: '<script>alert("xss")</script>user@test.com',
      password: 'Test123!',
    };

    const result = await pipe.transform(maliciousInput, {
      metatype: LoginDto,
    });

    expect(result.email).not.toContain('<script>');
    expect(result.email).toBe('user@test.com');
  });

  it('should reject invalid email format', async () => {
    const invalidInput = {
      email: 'invalid-email',
      password: 'Test123!',
    };

    await expect(
      pipe.transform(invalidInput, {
        metatype: LoginDto,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject short passwords', async () => {
    const invalidInput = {
      email: 'test@example.com',
      password: '123',
    };

    await expect(
      pipe.transform(invalidInput, {
        metatype: LoginDto,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should accept valid input', async () => {
    const validInput = {
      email: 'test@example.com',
      password: 'ValidPassword123!',
    };

    const result = await pipe.transform(validInput, {
      metatype: LoginDto,
    });

    expect(result).toBeDefined();
    expect(result.email).toBe('test@example.com');
    expect(result.password).toBe('ValidPassword123!');
  });

  it('should handle SQL injection attempts', async () => {
    const maliciousInput = {
      email: "test'; DROP TABLE users; --@example.com",
      password: 'Test123!',
    };

    const result = await pipe.transform(maliciousInput, {
      metatype: LoginDto,
    });

    expect(result.email).not.toContain('DROP TABLE');
    expect(result.email).not.toContain('--');
  });
});
