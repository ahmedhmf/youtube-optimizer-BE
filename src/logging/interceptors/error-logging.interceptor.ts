// src/logging/interceptors/error-logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LogSeverity, ErrorType } from '../dto/log.types';
import { ErrorLogService } from '../services/error-log.service';

@Injectable()
export class ErrorLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorLoggingInterceptor.name);

  constructor(private readonly errorLogService: ErrorLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const requestId = request.requestId || `req_${Date.now()}`;

    return next.handle().pipe(
      catchError((error) => {
        // Log the error asynchronously
        this.errorLogService.logError({
          errorType: this.determineErrorType(error),
          message: error.message || 'Unknown error',
          severity: LogSeverity.ERROR,
          stackTrace: error.stack,
          context: {
            controller: context.getClass().name,
            handler: context.getHandler().name,
          },
          userId: request.user?.id,
          endpoint: request.path,
          method: request.method,
          statusCode: error.status || 500,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          requestId,
        });

        return throwError(() => error);
      }),
    );
  }

  private determineErrorType(error: any): ErrorType {
    if (error.name?.includes('Validation')) return ErrorType.VALIDATION;
    if (error.name?.includes('Database')) return ErrorType.DATABASE;
    if (error.name?.includes('Auth')) return ErrorType.AUTHENTICATION;
    if (error.status === 401) return ErrorType.AUTHENTICATION;
    if (error.status === 403) return ErrorType.AUTHORIZATION;
    if (error.status === 404) return ErrorType.NOT_FOUND;
    if (error.status === 429) return ErrorType.RATE_LIMIT;
    return ErrorType.INTERNAL;
  }
}
