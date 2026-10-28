import { type ExecutionContext, createParamDecorator } from '@nestjs/common';

import { AUTH_USER, type AuthUser } from '../guards/jwt-auth.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser =>
    context.switchToHttp().getRequest()[AUTH_USER],
);
