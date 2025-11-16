import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class CacheService implements OnModuleInit {
  private readonly logger = new Logger(CacheService.name);
  private client: RedisClientType | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    const redisUrl = redisPassword
      ? `redis://:${redisPassword}@${redisHost}:${redisPort}`
      : `redis://${redisHost}:${redisPort}`;

    try {
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: false, // Disable reconnect for development
          connectTimeout: 1000,
        },
      });

      this.client.on('connect', () => {
        this.logger.log('Connected to Redis server');
      });

      this.client.on('disconnect', () => {
        this.logger.warn('Disconnected from Redis server');
      });

      await this.client.connect();
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error.message || error);
      // For development, we'll use in-memory fallback
      this.logger.warn('Using in-memory cache fallback for development');
      this.client = null;
    }
  }

  /**
   * Store a key-value pair with optional expiration time
   * @param key The key to store
   * @param value The value to store
   * @param ttlSeconds Time to live in seconds (optional)
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (!this.client) {
        // In-memory fallback for development
        this.logger.warn(`Cache SET fallback for key: ${key}`);
        return;
      }

      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      this.logger.debug(`Cached key: ${key}, TTL: ${ttlSeconds || 'none'}`);
    } catch (error) {
      this.logger.error(`Failed to cache key ${key}:`, error);
    }
  }

  /**
   * Retrieve a value by key
   * @param key The key to retrieve
   * @returns The value or null if not found
   */
  async get(key: string): Promise<string | null> {
    try {
      if (!this.client) {
        // In-memory fallback for development
        this.logger.warn(`Cache GET fallback for key: ${key}`);
        return null;
      }

      const value = await this.client.get(key);
      this.logger.debug(`Retrieved key: ${key}, found: ${!!value}`);
      return value;
    } catch (error) {
      this.logger.error(`Failed to retrieve key ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete a key from the cache
   * @param key The key to delete
   */
  async del(key: string): Promise<void> {
    try {
      if (!this.client) {
        // In-memory fallback for development
        this.logger.warn(`Cache DEL fallback for key: ${key}`);
        return;
      }

      await this.client.del(key);
      this.logger.debug(`Deleted key: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete key ${key}:`, error);
    }
  }

  /**
   * Check if a key exists in the cache
   * @param key The key to check
   * @returns True if the key exists, false otherwise
   */
  async exists(key: string): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }

      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      this.logger.error(`Failed to check existence of key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set expiration time for a key
   * @param key The key to set expiration for
   * @param ttlSeconds Time to live in seconds
   */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      if (!this.client) {
        return;
      }

      await this.client.expire(key, ttlSeconds);
      this.logger.debug(`Set expiration for key: ${key}, TTL: ${ttlSeconds}`);
    } catch (error) {
      this.logger.error(`Failed to set expiration for key ${key}:`, error);
    }
  }

  /**
   * Get the time to live for a key
   * @param key The key to check
   * @returns TTL in seconds, -1 if no expiration, -2 if key doesn't exist
   */
  async ttl(key: string): Promise<number> {
    try {
      if (!this.client) {
        return -2;
      }

      return await this.client.ttl(key);
    } catch (error) {
      this.logger.error(`Failed to get TTL for key ${key}:`, error);
      return -2;
    }
  }
}