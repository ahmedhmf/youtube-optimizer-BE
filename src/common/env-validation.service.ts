import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RequiredEnvVar {
  key: string;
  description: string;
  required: boolean;
  defaultValue?: string;
}

@Injectable()
export class EnvValidationService {
  private readonly logger = new Logger(EnvValidationService.name);

  private readonly requiredVars: RequiredEnvVar[] = [
    // Core
    { key: 'NODE_ENV', description: 'Application environment', required: true },
    {
      key: 'PORT',
      description: 'Application port',
      required: true,
      defaultValue: '3000',
    },

    // Supabase
    {
      key: 'SUPABASE_URL',
      description: 'Supabase project URL',
      required: true,
    },
    { key: 'SUPABASE_KEY', description: 'Supabase anon key', required: true },
    {
      key: 'SUPABASE_SERVICE_KEY',
      description: 'Supabase service role key',
      required: true,
    },

    // External APIs
    {
      key: 'OPENAI_API_KEY',
      description: 'OpenAI API key for AI suggestions',
      required: true,
    },
    {
      key: 'YOUTUBE_API_KEY',
      description: 'YouTube Data API key',
      required: true,
    },

    // Security
    { key: 'JWT_SECRET', description: 'JWT signing secret', required: true },
    {
      key: 'SESSION_SECRET',
      description: 'Session encryption secret',
      required: true,
    },
    { key: 'CSRF_SECRET', description: 'CSRF token secret', required: true },

    // Redis
    {
      key: 'REDIS_HOST',
      description: 'Redis host',
      required: true,
      defaultValue: 'localhost',
    },
    {
      key: 'REDIS_PORT',
      description: 'Redis port',
      required: true,
      defaultValue: '6379',
    },
    { key: 'REDIS_PASSWORD', description: 'Redis password', required: false },

    // CORS
    {
      key: 'FRONTEND_URL',
      description: 'Frontend application URL',
      required: true,
    },
    {
      key: 'CORS_ORIGINS',
      description: 'Allowed CORS origins',
      required: true,
    },
    { key: 'BACKEND_URL', description: 'Backend API URL', required: true },

    // OAuth (Optional)
    {
      key: 'GOOGLE_CLIENT_ID',
      description: 'Google OAuth client ID',
      required: false,
    },
    {
      key: 'GOOGLE_CLIENT_SECRET',
      description: 'Google OAuth client secret',
      required: false,
    },

    // Stripe (Optional)
    {
      key: 'STRIPE_SECRET_KEY',
      description: 'Stripe secret key',
      required: false,
    },
  ];

  constructor(private readonly configService: ConfigService) {}

  /**
   * Validate all required environment variables on application startup
   * Throws error if critical variables are missing
   */
  validateEnvironment(): void {
    this.logger.log('🔍 Validating environment variables...');

    const missing: string[] = [];
    const warnings: string[] = [];
    const validated: string[] = [];

    for (const envVar of this.requiredVars) {
      const value = this.configService.get<string>(envVar.key);

      if (!value || value.trim() === '') {
        if (envVar.required) {
          missing.push(`${envVar.key} - ${envVar.description}`);
        } else {
          warnings.push(`${envVar.key} - ${envVar.description} (optional)`);
        }
      } else {
        validated.push(envVar.key);

        // Validate specific formats
        this.validateFormat(envVar.key, value);
      }
    }

    // Log results
    this.logger.log(`✅ Validated ${validated.length} environment variables`);

    if (warnings.length > 0) {
      this.logger.warn(`⚠️  Missing optional variables (${warnings.length}):`);
      warnings.forEach((w) => this.logger.warn(`   - ${w}`));
    }

    if (missing.length > 0) {
      this.logger.error(
        `❌ Missing required environment variables (${missing.length}):`,
      );
      missing.forEach((m) => this.logger.error(`   - ${m}`));
      throw new Error(
        `Missing required environment variables. Check .env file and compare with .env.example`,
      );
    }

    // Validate NODE_ENV value
    this.validateNodeEnv();

    // Security checks
    this.validateSecuritySecrets();

    this.logger.log('✅ Environment validation passed!');
  }

  /**
   * Validate specific environment variable formats
   */
  private validateFormat(key: string, value: string): void {
    switch (key) {
      case 'PORT':
        const port = parseInt(value, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          throw new Error(`Invalid PORT: ${value}. Must be between 1-65535`);
        }
        break;

      case 'SUPABASE_URL':
        if (!value.startsWith('http://') && !value.startsWith('https://')) {
          throw new Error(
            `Invalid SUPABASE_URL: Must start with http:// or https://`,
          );
        }
        break;

      case 'REDIS_PORT':
        const redisPort = parseInt(value, 10);
        if (isNaN(redisPort) || redisPort < 1 || redisPort > 65535) {
          throw new Error(
            `Invalid REDIS_PORT: ${value}. Must be between 1-65535`,
          );
        }
        break;

      case 'CORS_ORIGINS':
        const origins = value.split(',');
        if (origins.length === 0) {
          throw new Error('CORS_ORIGINS must contain at least one origin');
        }
        break;
    }
  }

  /**
   * Validate NODE_ENV has acceptable value
   */
  private validateNodeEnv(): void {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const validEnvs = ['development', 'staging', 'production', 'test'];
    if (!nodeEnv) {
      throw new Error('NODE_ENV is not set');
    }
    if (!validEnvs.includes(nodeEnv)) {
      this.logger.warn(
        `⚠️  NODE_ENV="${nodeEnv}" is not standard. Expected: ${validEnvs.join(', ')}`,
      );
    }
  }

  /**
   * Validate security secrets meet minimum requirements
   */
  private validateSecuritySecrets(): void {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    const sessionSecret = this.configService.get<string>('SESSION_SECRET');
    const csrfSecret = this.configService.get<string>('CSRF_SECRET');

    // Check minimum length
    if (jwtSecret && jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }

    if (sessionSecret && sessionSecret.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters long');
    }

    if (csrfSecret && csrfSecret.length < 32) {
      throw new Error('CSRF_SECRET must be at least 32 characters long');
    }

    // Warn about default/weak secrets in production
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    if (nodeEnv === 'production') {
      const weakPatterns = [
        'change-in-production',
        'your-secret',
        'default',
        'example',
        'test',
        '12345',
      ];

      const checkWeak = (secret: string, name: string) => {
        const lower = secret.toLowerCase();
        for (const pattern of weakPatterns) {
          if (lower.includes(pattern)) {
            throw new Error(
              `🚨 SECURITY WARNING: ${name} contains weak pattern "${pattern}". ` +
                `Generate strong secret using: node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"`,
            );
          }
        }
      };
      if (!jwtSecret || !sessionSecret || !csrfSecret) {
        throw new Error(
          `🚨 SECURITY WARNING: One or more security secrets are not set in production environment.`,
        );
      }
      checkWeak(jwtSecret, 'JWT_SECRET');
      checkWeak(sessionSecret, 'SESSION_SECRET');
      checkWeak(csrfSecret, 'CSRF_SECRET');
    }
  }

  /**
   * Get environment summary for logging (without exposing secrets)
   */
  getEnvironmentSummary(): Record<string, string> {
    const summary: Record<string, string> = {};

    for (const envVar of this.requiredVars) {
      const value = this.configService.get<string>(envVar.key);

      if (value) {
        // Mask sensitive values
        if (this.isSensitive(envVar.key)) {
          summary[envVar.key] = this.maskValue(value);
        } else {
          summary[envVar.key] = value;
        }
      } else {
        summary[envVar.key] = '<not set>';
      }
    }

    return summary;
  }

  /**
   * Check if environment variable contains sensitive data
   */
  private isSensitive(key: string): boolean {
    const sensitivePatterns = [
      'SECRET',
      'KEY',
      'PASSWORD',
      'TOKEN',
      'CREDENTIALS',
    ];

    return sensitivePatterns.some((pattern) =>
      key.toUpperCase().includes(pattern),
    );
  }

  /**
   * Mask sensitive values for logging
   */
  private maskValue(value: string): string {
    if (value.length <= 8) {
      return '****';
    }
    return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
  }
}
