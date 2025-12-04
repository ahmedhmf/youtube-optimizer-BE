import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CorrelationId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{ correlationId?: string }>();
    return request.correlationId || 'unknown';
  },
);
