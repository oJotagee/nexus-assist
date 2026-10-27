import { describe, expect, it, mock } from 'bun:test';
import {
  type CallHandler,
  type ExecutionContext,
  ServiceUnavailableException,
} from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';

import {
  IdempotencyKeyReuseError,
  MissingIdempotencyKeyError,
} from '@/domain/errors/idempotency.error';
import { IdempotencyInterceptor } from '@/presentation/interceptors/idempotency.interceptor';
import { LegacyInstabilityInterceptor } from '@/presentation/interceptors/legacy-instability.interceptor';
import { InMemoryIdempotencyStore } from '@tests/unit/support/in-memory';

type FakeRequest = {
  method: string;
  originalUrl: string;
  body: unknown;
  headers: Record<string, string>;
};

function createContext(request: Partial<FakeRequest> = {}) {
  const response = {
    statusCode: 201,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
  };

  const context = {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'POST',
        originalUrl: '/internal/employees/emp_ana/tickets',
        body: { title: 'VPN' },
        headers: {},
        ...request,
      }),
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;

  return { context, response };
}

function handlerReturning(body: unknown) {
  const handle = mock(() => of(body));
  return { handler: { handle } as CallHandler, handle };
}

describe('LegacyInstabilityInterceptor', () => {
  const create = (failureRate: number, random: () => number) =>
    new LegacyInstabilityInterceptor({ failureRate, maxLatencyMs: 0 }, random);

  it('responde 503 com Retry-After sem chamar o handler', async () => {
    const { context, response } = createContext();
    const { handler, handle } = handlerReturning('ok');

    const result = lastValueFrom(create(0.15, () => 0.1).intercept(context, handler));

    await expect(result).rejects.toBeInstanceOf(ServiceUnavailableException);
    await result.catch(() => undefined);
    expect(handle).not.toHaveBeenCalled();
    expect(response.headers['Retry-After']).toBe('1');
  });

  it('deixa passar quando o sorteio fica acima da taxa', async () => {
    const { context } = createContext();
    const { handler } = handlerReturning('ok');

    expect(await lastValueFrom(create(0.15, () => 0.9).intercept(context, handler))).toBe('ok');
  });

  it('com taxa zero nunca falha', async () => {
    const { context } = createContext();
    const { handler } = handlerReturning('ok');

    expect(await lastValueFrom(create(0, () => 0).intercept(context, handler))).toBe('ok');
  });
});

describe('IdempotencyInterceptor', () => {
  it('exige a Idempotency-Key em escritas', () => {
    const { context } = createContext();
    const { handler } = handlerReturning({});

    expect(() =>
      new IdempotencyInterceptor(new InMemoryIdempotencyStore()).intercept(context, handler),
    ).toThrow(MissingIdempotencyKeyError);
  });

  it('não interfere em leituras', async () => {
    const { context } = createContext({ method: 'GET' });
    const { handler } = handlerReturning(['INC-20311']);

    const result = new IdempotencyInterceptor(new InMemoryIdempotencyStore()).intercept(
      context,
      handler,
    );

    expect(await lastValueFrom(result)).toEqual(['INC-20311']);
  });

  it('a repetição devolve a resposta gravada sem executar de novo', async () => {
    const store = new InMemoryIdempotencyStore();
    const interceptor = new IdempotencyInterceptor(store);
    const headers = { 'idempotency-key': 'draft-123' };

    const first = createContext({ headers });
    const firstHandler = handlerReturning({ id: 'INC-20341' });
    expect(await lastValueFrom(interceptor.intercept(first.context, firstHandler.handler))).toEqual(
      {
        id: 'INC-20341',
      },
    );

    const retry = createContext({ headers });
    const retryHandler = handlerReturning({ id: 'INC-20342' });
    const replayed = await lastValueFrom(
      interceptor.intercept(retry.context, retryHandler.handler),
    );

    expect(replayed).toEqual({ id: 'INC-20341' });
    expect(retryHandler.handle).not.toHaveBeenCalled();
    expect(retry.response.statusCode).toBe(201);
    expect(retry.response.headers['Idempotent-Replayed']).toBe('true');
  });

  it('recusa a mesma chave com outro conteúdo', async () => {
    const store = new InMemoryIdempotencyStore();
    const interceptor = new IdempotencyInterceptor(store);
    const headers = { 'idempotency-key': 'draft-123' };

    await lastValueFrom(
      interceptor.intercept(createContext({ headers }).context, handlerReturning({}).handler),
    );

    const other = createContext({ headers, body: { title: 'Outro assunto' } });
    const result = lastValueFrom(
      interceptor.intercept(other.context, handlerReturning({}).handler),
    );

    await expect(result).rejects.toBeInstanceOf(IdempotencyKeyReuseError);
  });
});
