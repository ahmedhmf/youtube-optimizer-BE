import { Global, Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { GlobalExceptionFilter } from './global-exception.filter';
import { ApiLoggingInterceptor } from './interceptors/api-logging.interceptor';
import { ErrorLoggingInterceptor } from './interceptors/error-logging.interceptor';
import { LogsController } from './logs.controller';
import { ApiLogService } from './services/api-log.service';
import { ErrorLogService } from './services/error-log.service';
import { LogAggregatorService } from './services/log-aggregator.service';
import { SystemLogService } from './services/system-log.service';
import { UserLogService } from './services/user-log.service';
import { VideoAnalysisLogService } from './services/video-analysis-log.servce';
import { HealthMonitorService } from './services/health-monitor.service';
import { StructuredLoggerService } from './structured-logger.service';
import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { RequestLoggingMiddleware } from './request-logging.middleware';

@Global()
@Module({
  imports: [SupabaseModule],
  providers: [
    // Services
    UserLogService,
    ErrorLogService,
    VideoAnalysisLogService,
    ApiLogService,
    SystemLogService,
    LogAggregatorService,
    HealthMonitorService,
    StructuredLoggerService,

    // Global error filter
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },

    // Global interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: ErrorLoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiLoggingInterceptor,
    },
  ],
  controllers: [LogsController],
  exports: [
    UserLogService,
    ErrorLogService,
    VideoAnalysisLogService,
    ApiLogService,
    SystemLogService,
    LogAggregatorService,
    HealthMonitorService,
    StructuredLoggerService,
  ],
})
export class LoggingModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, RequestLoggingMiddleware)
      .forRoutes('*');
  }
}
