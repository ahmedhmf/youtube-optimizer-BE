import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorType, LogSeverity } from './dto/log.types';
import { ErrorLogService } from './services/error-log.service';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
  requestId?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly errorLogService: ErrorLogService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorType = ErrorType.INTERNAL;

    // Determine error type and status
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as { message?: string }).message || message;

      // Map HTTP status to error type
      if (status === HttpStatus.BAD_REQUEST) errorType = ErrorType.VALIDATION;
      else if (status === HttpStatus.UNAUTHORIZED)
        errorType = ErrorType.AUTHENTICATION;
      else if (status === HttpStatus.FORBIDDEN)
        errorType = ErrorType.AUTHORIZATION;
      else if (status === HttpStatus.NOT_FOUND) errorType = ErrorType.NOT_FOUND;
      else if (status === HttpStatus.TOO_MANY_REQUESTS)
        errorType = ErrorType.RATE_LIMIT;
    } else if (exception instanceof Error) {
      message = exception.message;

      // Determine error type from error name
      if (exception.name.includes('Database')) {
        errorType = ErrorType.DATABASE;
      } else if (exception.name.includes('Validation')) {
        errorType = ErrorType.VALIDATION;
      }
    }

    // Log the error
    await this.errorLogService.logError({
      errorCode: `ERR_${status}`,
      errorType,
      message,
      severity: Number(status) >= 500 ? LogSeverity.ERROR : LogSeverity.WARNING,
      stackTrace: exception instanceof Error ? exception.stack : undefined,
      context: {
        url: request.url,
        body: request.body,
        query: request.query,
        params: request.params,
      },
      userId: (request as AuthenticatedRequest).user?.id,
      endpoint: request.path,
      method: request.method,
      statusCode: status,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: (request as AuthenticatedRequest).requestId,
    });

    // Send response
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      error: exception instanceof HttpException ? exception.name : 'Error',
    });
  }
}
