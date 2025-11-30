import { Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

export interface StructuredLog {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  correlationId?: string;
  context?: string;
  userId?: string;
  metadata?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

@Injectable()
export class StructuredLoggerService implements LoggerService {
  private isDevelopment: boolean;
  private winstonLogger: winston.Logger;

  constructor(private readonly configService: ConfigService) {
    this.isDevelopment =
      this.configService.get<string>('NODE_ENV') !== 'production';
    this.initializeWinston();
  }

  /**
   * Initialize Winston logger with file rotation
   */
  private initializeWinston(): void {
    const logRetentionDays =
      this.configService.get<number>('LOG_RETENTION_DAYS') || 14;

    // File transport for all logs
    const fileTransport = new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: `${logRetentionDays}d`,
      format: winston.format.json(),
    });

    // File transport for errors only
    const errorFileTransport = new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: `${logRetentionDays}d`,
      level: 'error',
      format: winston.format.json(),
    });

    this.winstonLogger = winston.createLogger({
      level: 'debug',
      format: winston.format.json(),
      transports: [fileTransport, errorFileTransport],
    });
  }

  /**
   * Write a log entry (to console and files)
   */
  private writeLog(log: StructuredLog): void {
    // Write to file via Winston
    this.winstonLogger.log({
      level: log.level,
      message: log.message,
      timestamp: log.timestamp,
      correlationId: log.correlationId,
      context: log.context,
      userId: log.userId,
      metadata: log.metadata,
      error: log.error,
    });

    // Also write to console for development/Railway logs
    if (this.isDevelopment) {
      // Pretty print in development
      const emoji = this.getEmoji(log.level);
      const timestamp = new Date(log.timestamp).toLocaleTimeString();
      console.log(
        `${emoji} [${timestamp}] [${log.level.toUpperCase()}] ${log.context ? `[${log.context}]` : ''} ${log.message}`,
      );
      if (log.metadata) {
        console.log('  Metadata:', log.metadata);
      }
      if (log.error) {
        console.error('  Error:', log.error.message);
        if (log.error.stack) {
          console.error(log.error.stack);
        }
      }
    } else {
      // JSON format in production for log aggregation
      console.log(JSON.stringify(log));
    }
  }

  private getEmoji(level: string): string {
    const emojis: Record<string, string> = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
    };
    return emojis[level] || 'ℹ️';
  }

  /**
   * Standard NestJS logger methods
   */
  log(message: string, context?: string, metadata?: Record<string, any>): void {
    this.info(message, context, metadata);
  }

  error(
    message: string,
    trace?: string,
    context?: string,
    metadata?: Record<string, any>,
  ): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      context,
      metadata,
      error: trace
        ? {
            message,
            stack: trace,
          }
        : undefined,
    });
  }

  warn(
    message: string,
    context?: string,
    metadata?: Record<string, any>,
  ): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      context,
      metadata,
    });
  }

  debug(
    message: string,
    context?: string,
    metadata?: Record<string, any>,
  ): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'debug',
      message,
      context,
      metadata,
    });
  }

  verbose(
    message: string,
    context?: string,
    metadata?: Record<string, any>,
  ): void {
    this.debug(message, context, metadata);
  }

  /**
   * Enhanced structured logging methods
   */
  info(
    message: string,
    context?: string,
    metadata?: Record<string, any>,
  ): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      context,
      metadata,
    });
  }

  logWithCorrelation(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    correlationId: string,
    context?: string,
    metadata?: Record<string, any>,
  ): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId,
      context,
      metadata,
    });
  }

  logRequest(
    correlationId: string,
    method: string,
    url: string,
    userId?: string,
    metadata?: Record<string, any>,
  ): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `${method} ${url}`,
      correlationId,
      userId,
      context: 'HTTP',
      metadata: {
        ...metadata,
        method,
        url,
      },
    });
  }

  logResponse(
    correlationId: string,
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    userId?: string,
  ): void {
    const level = statusCode >= 400 ? 'warn' : 'info';
    this.writeLog({
      timestamp: new Date().toISOString(),
      level,
      message: `${method} ${url} ${statusCode} - ${duration}ms`,
      correlationId,
      userId,
      context: 'HTTP',
      metadata: {
        method,
        url,
        statusCode,
        duration,
      },
    });
  }

  logError(
    correlationId: string,
    error: Error,
    context?: string,
    metadata?: Record<string, any>,
  ): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: error.message,
      correlationId,
      context,
      metadata,
      error: {
        message: error.message,
        stack: error.stack,
        code:
          'code' in error && typeof error.code === 'string'
            ? error.code
            : undefined,
      },
    });
  }

  logBusinessEvent(
    correlationId: string,
    eventName: string,
    userId?: string,
    metadata?: Record<string, any>,
  ): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: eventName,
      correlationId,
      userId,
      context: 'BusinessEvent',
      metadata,
    });
  }
}
