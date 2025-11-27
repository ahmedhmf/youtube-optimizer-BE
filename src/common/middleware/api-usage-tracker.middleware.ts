// Create: src/common/middleware/api-usage-tracker.middleware.ts
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SupabaseService } from '../../supabase/supabase.service';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@Injectable()
export class ApiUsageTrackerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ApiUsageTrackerMiddleware.name);

  constructor(private readonly supabase: SupabaseService) {}

  use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const startTime = Date.now();

    // Capture the response
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      const userId = req.user?.id;

      // Only track if user is authenticated
      if (userId) {
        try {
          const client = this.supabase.getServiceClient();

          void client.from('api_usage_logs').insert({
            user_id: userId,
            endpoint: req.path,
            method: req.method,
            status_code: res.statusCode,
            response_time: responseTime,
            ip_address: req.ip,
            user_agent: req.headers['user-agent'],
            metadata: {
              query: req.query,
              params: req.params,
            },
          });
        } catch (error) {
          this.logger.error('Failed to log API usage:', error);
        }
      }
    });

    next();
  }
}
