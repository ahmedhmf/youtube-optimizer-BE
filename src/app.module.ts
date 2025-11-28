import { Module, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { APP_PIPE, APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CommonModule } from './common/common.module';
import { SecurityMiddleware } from './common/security.middleware';
import { IPRateLimitMiddleware } from './common/ip-rate-limit.middleware';
import { EnvironmentService } from './common/environment.service';
import { AdminModule } from './admin/admin.module';
import { ApiUsageTrackerMiddleware } from './common/middleware/api-usage-tracker.middleware';
import { LoggingModule } from './logging/logging.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { HealthModule } from './health/health.module';
import { UserFeedbackModule } from './user-feedback/user-feedback.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LoggingModule,
    CommonModule,
    HealthModule,
    OnboardingModule,
    AuthModule,
    AuditModule,
    SupabaseModule,
    ThrottlerModule.forRootAsync({
      imports: [CommonModule],
      useFactory: (environmentService: EnvironmentService) => {
        return environmentService.getRateLimitConfig();
      },
      inject: [EnvironmentService],
    }),
    AdminModule,
    LoggingModule,
    UserFeedbackModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply rate limiting first, then security middleware
    consumer.apply(IPRateLimitMiddleware).forRoutes('*');

    consumer.apply(SecurityMiddleware).forRoutes('*');
    consumer.apply(ApiUsageTrackerMiddleware).forRoutes('*');
  }
}
