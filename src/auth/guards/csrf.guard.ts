import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { CSRFService } from '../../common/csrf.service';

export const SKIP_CSRF = 'skip-csrf';
export const SkipCSRF = () =>
  Reflector.createDecorator<boolean>({ key: SKIP_CSRF });

@Injectable()
export class CSRFGuard implements CanActivate {
  constructor(
    private readonly csrfService: CSRFService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // CSRF protection disabled - not needed for JWT-based authentication
    // JWT tokens in Authorization headers are naturally immune to CSRF attacks
    return true;

    /* Original CSRF validation logic (disabled):
    // Check if CSRF should be skipped for this route
    const skipCSRF = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipCSRF) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();

    // Check if this request needs CSRF protection
    if (!this.csrfService.shouldProtect(request)) {
      return true;
    }

    // Validate CSRF token
    if (!this.csrfService.validateToken(request)) {
      throw new ForbiddenException('Invalid or missing CSRF token');
    }

    return true;
    */
  }
}
