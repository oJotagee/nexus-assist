import { describe, expect, it } from 'bun:test';

import { createAgentModel, resolveProvider } from '@/infrastructure/agent/model';
import { isQuotaError, isTimeoutError, toError } from '@/infrastructure/agent/nexo-agent.runner';

describe('createAgentModel', () => {
  it('usa o Gemini gratuito por padrão', () => {
    const model = createAgentModel({ googleApiKey: 'chave-google' });

    expect(model).toMatchObject({ provider: 'google', id: 'gemini-3.5-flash-lite' });
    expect(model?.providerOptions).toEqual({
      google: { thinkingConfig: { thinkingLevel: 'low' } },
    });
  });

  it('sem a chave do provedor escolhido, fica indisponível', () => {
    expect(createAgentModel({ anthropicApiKey: 'só-anthropic' })).toBeNull();
    expect(createAgentModel({ provider: 'anthropic', googleApiKey: 'só-google' })).toBeNull();
  });

  it('a Anthropic continua disponível por configuração', () => {
    const model = createAgentModel({ provider: 'anthropic', anthropicApiKey: 'chave' });

    expect(model).toMatchObject({ provider: 'anthropic', id: 'claude-opus-5-5' });
    expect(model?.providerOptions.anthropic).toMatchObject({ effort: 'low', fallbacks: 'default' });
  });

  it('respeita o modelo configurado', () => {
    expect(createAgentModel({ googleApiKey: 'k', modelId: 'gemini-2.5-flash' })?.id).toBe(
      'gemini-2.5-flash',
    );
  });

  it('provedor desconhecido cai no padrão gratuito', () => {
    expect(resolveProvider('openai')).toBe('google');
    expect(resolveProvider(' Anthropic ')).toBe('anthropic');
  });
});

describe('isQuotaError', () => {
  it('reconhece o limite do plano gratuito', () => {
    expect(isQuotaError(Object.assign(new Error('Too Many Requests'), { statusCode: 429 }))).toBe(
      true,
    );
    expect(isQuotaError(new Error('RESOURCE_EXHAUSTED: Quota exceeded for metric'))).toBe(true);
  });

  it('não confunde com outros erros', () => {
    expect(isQuotaError(new Error('fetch failed'))).toBe(false);
    expect(isQuotaError(new Error('ticket INC-14290 not found'))).toBe(false);
  });
});

describe('isTimeoutError', () => {
  it('reconhece o turno abortado pelo tempo máximo', () => {
    expect(isTimeoutError(new DOMException('The operation timed out.', 'TimeoutError'))).toBe(true);
    expect(
      isTimeoutError(
        Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }),
      ),
    ).toBe(true);
  });

  it('não confunde com cota esgotada', () => {
    expect(isTimeoutError(new Error('RESOURCE_EXHAUSTED: Quota exceeded'))).toBe(false);
  });
});

describe('toError', () => {
  it('normaliza o erro do provedor que chega como objeto pelo stream', () => {
    const error = toError({
      statusCode: 429,
      message: 'You exceeded your current quota',
      responseBody: '{"error":{"status":"RESOURCE_EXHAUSTED"}}',
    });

    expect(error).toBeInstanceOf(Error);
    expect(isQuotaError(error)).toBe(true);
  });

  it('mantém erros que já são Error', () => {
    const original = new Error('falhou');
    expect(toError(original)).toBe(original);
  });
});
