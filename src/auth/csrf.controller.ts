import { Controller, Get, Req, Res, SetMetadata } from '@nestjs/common';
import { CSRFService } from '../common/csrf.service';
import { SKIP_CSRF } from '../auth/guards/csrf.guard';
import type { Request, Response } from 'express';

// Helper decorator to skip CSRF protection
const SkipCSRF = () => SetMetadata(SKIP_CSRF, true);

@Controller('auth')
export class CSRFController {
  constructor(private readonly csrfService: CSRFService) {}

  /**
   * Get CSRF token for frontend applications
   * This endpoint provides the CSRF token that should be included in subsequent requests
   */
  @Get('csrf-token')
  @SkipCSRF()
  getCsrfToken(@Req() req: Request, @Res() res: Response) {
    console.log('Generating CSRF token for session:', req.sessionID);
    const token = this.csrfService.generateToken(req);

    // Set token as cookie for automatic inclusion in requests
    this.csrfService.setCsrfCookie(req, res);

    // Also return token in response for manual inclusion in headers
    return res.json({
      csrfToken: token,
      message: 'CSRF token generated successfully',
      usage: {
        cookie: 'Token automatically set as cookie for same-origin requests',
        header: 'Include in X-CSRF-Token header for AJAX requests',
        body: 'Include as _csrf field in form submissions',
      },
    });
  }

  /**
   * Verify CSRF token (for testing purposes)
   */
  @Get('csrf-verify')
  @SkipCSRF()
  verifyCsrfToken(@Req() req: Request) {
    const isValid = this.csrfService.validateToken(req);

    return {
      valid: isValid,
      message: isValid
        ? 'CSRF token is valid'
        : 'CSRF token is invalid or missing',
      tokenSources: {
        header: 'X-CSRF-Token',
        body: '_csrf field',
        query: '_csrf parameter',
      },
    };
  }
}
