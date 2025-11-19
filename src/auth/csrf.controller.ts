import { Controller, Get, Req, Res, SetMetadata } from '@nestjs/common';
import { CSRFService } from '../common/csrf.service';
import { SKIP_CSRF } from '../auth/guards/csrf.guard';
import type { Request, Response } from 'express';
import { ApiHeader, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

const SkipCSRF = () => SetMetadata(SKIP_CSRF, true);

@Controller('auth')
export class CSRFController {
  constructor(private readonly csrfService: CSRFService) {}

  @Get('csrf-token')
  @ApiOperation({
    summary: 'Generate CSRF Token',
    description: `
    Generates a CSRF (Cross-Site Request Forgery) protection token for secure form submissions.
    
    **CSRF Protection Overview:**
    CSRF tokens prevent malicious websites from making unauthorized requests to your application
    on behalf of an authenticated user.
    
    **How to Use the Token:**
    1. **Automatic (Cookie)**: Token is set as HTTP-only cookie for same-origin requests
    2. **Manual (Header)**: Include token in 'X-CSRF-Token' header for AJAX requests
    3. **Forms**: Include as '_csrf' field in HTML form submissions
    
    **Security Features:**
    - Tokens are session-specific and expire with the session
    - Each token is cryptographically secure and unpredictable
    - Tokens are validated on all state-changing operations (POST, PUT, DELETE)
    
    **When Required:**
    - User registration and login
    - Profile updates
    - Password changes
    - Content creation/modification
    - Administrative actions
    `,
    externalDocs: {
      description: 'CSRF Protection Best Practices',
      url: 'https://owasp.org/www-community/attacks/csrf',
    },
  })
  @ApiResponse({
    status: 200,
    description: 'CSRF token generated successfully',
    schema: {
      type: 'object',
      properties: {
        csrfToken: {
          type: 'string',
          example: 'abc123def456ghi789jkl012mno345pqr678',
          description: 'CSRF token to include in requests',
        },
        message: {
          type: 'string',
          example: 'CSRF token generated successfully',
        },
        usage: {
          type: 'object',
          properties: {
            cookie: {
              type: 'string',
              example:
                'Token automatically set as cookie for same-origin requests',
              description: 'Cookie-based usage (automatic)',
            },
            header: {
              type: 'string',
              example: 'Include in X-CSRF-Token header for AJAX requests',
              description: 'Header-based usage (manual)',
            },
            body: {
              type: 'string',
              example: 'Include as _csrf field in form submissions',
              description: 'Form field usage (manual)',
            },
          },
        },
      },
    },
    headers: {
      'Set-Cookie': {
        description: 'CSRF token set as HTTP-only cookie',
        schema: {
          type: 'string',
          example: '_csrf=abc123...; Path=/; HttpOnly; SameSite=Strict',
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Server error during token generation',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Failed to generate CSRF token' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
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

  @Get('csrf-verify')
  @ApiOperation({
    summary: 'Verify CSRF Token',
    description: `
    Validates a CSRF token for testing and debugging purposes.
    
    **Testing Endpoint:**
    This endpoint helps developers test CSRF token implementation before
    using it in production endpoints.
    
    **Token Sources (in order of priority):**
    1. **X-CSRF-Token header** (recommended for AJAX)
    2. **_csrf form field** (for HTML forms) 
    3. **_csrf query parameter** (fallback, less secure)
    4. **Cookie value** (automatic validation)
    
    **How to Test:**
    1. First call /auth/csrf-token to get a token
    2. Include the token using one of the methods above
    3. Call this endpoint to verify the token works
    
    **Development Usage:**
    - Debug CSRF implementation issues
    - Verify frontend CSRF integration
    - Test different token delivery methods
    `,
  })
  @ApiHeader({
    name: 'X-CSRF-Token',
    description: 'CSRF token from /auth/csrf-token endpoint',
    required: false,
    example: 'abc123def456ghi789jkl012mno345pqr678',
  })
  @ApiQuery({
    name: '_csrf',
    description: 'CSRF token as query parameter (less secure, not recommended)',
    required: false,
    example: 'abc123def456ghi789jkl012mno345pqr678',
  })
  @ApiResponse({
    status: 200,
    description: 'Token validation result',
    schema: {
      type: 'object',
      properties: {
        valid: {
          type: 'boolean',
          example: true,
          description: 'Whether the CSRF token is valid',
        },
        message: {
          type: 'string',
          example: 'CSRF token is valid',
          enum: ['CSRF token is valid', 'CSRF token is invalid or missing'],
        },
        tokenSources: {
          type: 'object',
          properties: {
            header: {
              type: 'string',
              example: 'X-CSRF-Token',
              description: 'Header name for CSRF token',
            },
            body: {
              type: 'string',
              example: '_csrf field',
              description: 'Form field name for CSRF token',
            },
            query: {
              type: 'string',
              example: '_csrf parameter',
              description: 'Query parameter name for CSRF token',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid token format or missing session',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', example: false },
        message: {
          type: 'string',
          example: 'CSRF token is invalid or missing',
        },
        error: {
          type: 'string',
          example: 'No session found or invalid token format',
        },
      },
    },
  })
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
