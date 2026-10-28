import { createHash } from 'node:crypto';
import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
  Optional,
} from '@nestjs/common';
import { type Observable, catchError, from, of, switchMap } from 'rxjs';

import {
  IDEMPOTENCY_STORE,
  type IdempotencyStore,
  type StoredResponse,
} from '@/application/ports/idempotency-store.port';
import {
  IdempotencyKeyReuseError,
  IdempotencyRequestInProgressError,
  MissingIdempotencyKeyError,
} from '@/domain/errors/idempotency.error';

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

/** Quanto uma requisição concorrente espera a primeira terminar antes de desistir. */
export const IN_PROGRESS_WAIT_MS = 5_000;
export const IDEMPOTENCY_WAIT_MS = Symbol('IDEMPOTENCY_WAIT_MS');
const POLL_INTERVAL_MS = 100;

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
 * Escritas exigem Idempotency-Key. A chave é reservada antes de executar: se a mesma chave
 * chegar de novo (o assist repetiu, ou o funcionário clicou duas vezes), a segunda requisição
 * espera a primeira e devolve a mesma resposta, sem criar outro chamado.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly waitMs: number;

  constructor(
    @Inject(IDEMPOTENCY_STORE) private readonly store: IdempotencyStore,
    @Optional() @Inject(IDEMPOTENCY_WAIT_MS) waitMs?: number,
  ) {
    this.waitMs = waitMs ?? IN_PROGRESS_WAIT_MS;
  }

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

    return from(this.store.claim(key, requestHash)).pipe(
      switchMap((claim) => {
        if (claim.claimed) {
          return next.handle().pipe(
            switchMap(async (body) => {
              await this.store.complete(key, response.statusCode, body);
              return body;
            }),
            catchError(async (error) => {
              await this.store.release(key);
              throw error;
            }),
          );
        }

        if (claim.existing.requestHash !== requestHash) throw new IdempotencyKeyReuseError();

        return from(this.waitForCompletion(key, claim.existing)).pipe(
          switchMap((stored) => {
            response.status(stored.statusCode ?? 201);
            response.setHeader('Idempotent-Replayed', 'true');
            return of(stored.response);
          }),
        );
      }),
    );
  }

  private async waitForCompletion(key: string, first: StoredResponse): Promise<StoredResponse> {
    let current: StoredResponse | null = first;
    const deadline = Date.now() + this.waitMs;

    while (current && current.statusCode === null) {
      if (Date.now() >= deadline) throw new IdempotencyRequestInProgressError();
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      current = await this.store.find(key);
    }

    // A primeira falhou e liberou a chave: o cliente deve tentar de novo.
    if (!current) throw new IdempotencyRequestInProgressError();

    return current;
  }
}
