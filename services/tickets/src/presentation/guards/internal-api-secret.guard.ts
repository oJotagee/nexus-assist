import { createHash, timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import internalApiConfig from '@/infrastructure/config/internal-api.config';

export const INTERNAL_API_SECRET_HEADER = 'x-internal-secret';

const MIN_SECRET_LENGTH = 32;

type IncomingRequest = {
  headers: Record<string, string | string[] | undefined>;
};

@Injectable()
export class InternalApiSecretGuard implements CanActivate {
  private readonly logger = new Logger(InternalApiSecretGuard.name);

  constructor(
    @Inject(internalApiConfig.KEY)
    private readonly config: ConfigType<typeof internalApiConfig>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.secret;

    if (!expected || expected.length < MIN_SECRET_LENGTH) {
      this.logger.error(
        `INTERNAL_API_SECRET ausente ou com menos de ${MIN_SECRET_LENGTH} caracteres; bloqueando a rota.`,
      );
      throw new UnauthorizedException('Acesso não autorizado.');
    }

    const received = context.switchToHttp().getRequest<IncomingRequest>().headers[
      INTERNAL_API_SECRET_HEADER
    ];

    if (typeof received !== 'string' || !this.matches(received, expected)) {
      throw new UnauthorizedException('Acesso não autorizado.');
    }

    return true;
  }

  private matches(received: string, expected: string): boolean {
    const digest = (value: string) => createHash('sha256').update(value).digest();

    return timingSafeEqual(digest(received), digest(expected));
  }
}
