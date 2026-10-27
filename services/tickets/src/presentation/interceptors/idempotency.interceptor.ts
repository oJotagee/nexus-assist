import { createHash } from 'node:crypto';
import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable, from, of, switchMap } from 'rxjs';

import {
  IDEMPOTENCY_STORE,
  type IdempotencyStore,
} from '@/application/ports/idempotency-store.port';
import {
  IdempotencyKeyReuseError,
  MissingIdempotencyKeyError,
} from '@/domain/errors/idempotency.error';

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

type IncomingRequest = {
  method: string;
  originalUrl: string;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
};

type OutgoingResponse = {
  statusCode: number;
  status(code: number): void;
  setHeader(name: string, value: string): void;
};

/**
 * Escritas exigem Idempotency-Key. Se a mesma chave chegar de novo (o assist repetiu porque
 * não recebeu a resposta), devolve a resposta gravada em vez de criar outro chamado.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(IDEMPOTENCY_STORE) private readonly store: IdempotencyStore) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<IncomingRequest>();
    const response = http.getResponse<OutgoingResponse>();

    if (request.method !== 'POST') return next.handle();

    const key = request.headers[IDEMPOTENCY_KEY_HEADER];
    if (typeof key !== 'string' || !key.trim()) throw new MissingIdempotencyKeyError();

    const requestHash = createHash('sha256')
      .update(`${request.method} ${request.originalUrl} ${JSON.stringify(request.body ?? {})}`)
      .digest('hex');

    return from(this.store.find(key)).pipe(
      switchMap((stored) => {
        if (stored) {
          if (stored.requestHash !== requestHash) throw new IdempotencyKeyReuseError();

          response.status(stored.statusCode);
          response.setHeader('Idempotent-Replayed', 'true');
          return of(stored.response);
        }

        return next.handle().pipe(
          switchMap(async (body) => {
            const saved = await this.store.save(key, {
              requestHash,
              statusCode: response.statusCode,
              response: body,
            });

            // Outra requisição com a mesma chave terminou antes: devolve a dela.
            if (!saved) {
              const winner = await this.store.find(key);
              return winner?.response ?? body;
            }

            return body;
          }),
        );
      }),
    );
  }
}
