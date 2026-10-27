import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { type Observable, from, switchMap } from 'rxjs';

import legacyInstabilityConfig from '@/infrastructure/config/legacy-instability.config';

export const RANDOM_SOURCE = Symbol('RANDOM_SOURCE');

type OutgoingResponse = { setHeader(name: string, value: string): void };

/**
 * O sistema de chamados é legado e "de vez em quando fica indisponível por alguns segundos".
 * Este interceptor reproduz isso: latência aleatória e uma fração das requisições com 503,
 * sempre ANTES do handler, para a falha nunca deixar uma escrita pela metade.
 */
@Injectable()
export class LegacyInstabilityInterceptor implements NestInterceptor {
  private readonly random: () => number;

  constructor(
    @Inject(legacyInstabilityConfig.KEY)
    private readonly config: ConfigType<typeof legacyInstabilityConfig>,
    @Optional() @Inject(RANDOM_SOURCE) random?: () => number,
  ) {
    this.random = random ?? Math.random;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return from(this.simulate(context)).pipe(switchMap(() => next.handle()));
  }

  private async simulate(context: ExecutionContext): Promise<void> {
    const { failureRate, maxLatencyMs } = this.config;

    if (maxLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.round(this.random() * maxLatencyMs)));
    }

    if (failureRate > 0 && this.random() < failureRate) {
      context.switchToHttp().getResponse<OutgoingResponse>().setHeader('Retry-After', '1');

      throw new ServiceUnavailableException({
        statusCode: 503,
        error: 'TicketsUnavailableError',
        message: 'O sistema de chamados está indisponível no momento.',
      });
    }
  }
}
