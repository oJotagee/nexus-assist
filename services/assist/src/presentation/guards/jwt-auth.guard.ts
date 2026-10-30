import type { ConfigType } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';

import type { SessionTokenPayload } from '@/application/ports/services.port';
import jwtConfig from '@/infrastructure/config/jwt.config';

export const AUTH_USER = 'authUser';
const ROLES_KEY = 'roles';

export type AuthUser = { id: string; email: string; name: string; role: 'EMPLOYEE' | 'ANALYST' };

/** Restringe a rota a um papel. Sem o decorator, qualquer usuário autenticado acessa. */
export const Roles = (...roles: AuthUser['role'][]) => SetMetadata(ROLES_KEY, roles);

type IncomingRequest = {
  headers: { authorization?: string };
  [AUTH_USER]?: AuthUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    @Inject(jwtConfig.KEY) private readonly config: ConfigType<typeof jwtConfig>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<IncomingRequest>();
    const token = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new UnauthorizedException('Token ausente.');

    let payload: SessionTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<SessionTokenPayload>(token, {
        secret: this.config.secret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }

    const user: AuthUser = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
    request[AUTH_USER] = user;

    const roles = this.reflector.getAllAndOverride<AuthUser['role'][] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles && !roles.includes(user.role)) {
      throw new ForbiddenException('Você não tem acesso a esta área.');
    }

    return true;
  }
}
