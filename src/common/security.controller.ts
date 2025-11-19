import { Controller, Get, Headers } from '@nestjs/common';
import { SecurityConfigService } from '../common/security-config.service';

@Controller('security')
export class SecurityController {
  constructor(private readonly securityConfigService: SecurityConfigService) {}

  @Get('health')
  checkSecurityHeaders(@Headers() headers: Record<string, string>) {
    return {
      message: 'Security health check',
      timestamp: new Date().toISOString(),
      securityHeaders: {
        helmet: 'enabled',
        rateLimiting: 'enabled',
        cors: 'configured',
      },
      requestHeaders: {
        userAgent: headers['user-agent'],
        acceptLanguage: headers['accept-language'],
        host: headers.host,
      },
      securityConfig: {
        environment: process.env.NODE_ENV || 'development',
        hstsEnabled: process.env.NODE_ENV === 'production',
        cspEnabled: true,
      },
    };
  }

  @Get('csp-report')
  handleCspReport() {
    // This endpoint would handle Content Security Policy violation reports
    // In a real application, you'd log these violations for analysis
    return {
      message: 'CSP report endpoint ready',
      note: 'Configure your CSP report-uri to point to this endpoint',
    };
  }
}
