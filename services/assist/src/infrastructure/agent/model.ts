import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { Agent } from '@mastra/core/agent';

export const AGENT_MODEL = Symbol('AGENT_MODEL');

export type AgentProvider = 'google' | 'anthropic';

export type AgentModel = {
  id: string;
  provider: AgentProvider;
  languageModel: ConstructorParameters<typeof Agent>[0]['model'];
  maxOutputTokens: number;
  providerOptions: Record<string, Record<string, unknown>>;
};

/**
 * Padrão: Gemini Flash no plano gratuito do Google AI Studio (sem cartão de crédito).
 * A Anthropic continua disponível por configuração (AGENT_PROVIDER=anthropic).
 */
export const DEFAULT_PROVIDER: AgentProvider = 'google';
export const DEFAULT_MODEL: Record<AgentProvider, string> = {
  google: 'gemini-3.8-flash',
  anthropic: 'claude-opus-5-5',
};

/** Modelos da Anthropic com fallback de recusa no servidor (forma "default"). */
const ANTHROPIC_SERVER_FALLBACK = new Set([
  'claude-opus-5-5',
  'claude-sonnet-5-5',
  'claude-fable-5-1',
]);

export type AgentModelEnv = {
  provider?: string;
  modelId?: string;
  googleApiKey?: string;
  anthropicApiKey?: string;
};

export function resolveProvider(value: string | undefined): AgentProvider {
  return value?.trim().toLowerCase() === 'anthropic' ? 'anthropic' : DEFAULT_PROVIDER;
}

/**
 * Configuração do modelo do agent. Respostas de chat são curtas: raciocínio em nível baixo e
 * teto de saída pequeno. Sem a chave do provedor devolve null, e o chat avisa que o
 * assistente está indisponível (o resto do sistema funciona).
 */
export function createAgentModel(env: AgentModelEnv): AgentModel | null {
  const provider = resolveProvider(env.provider);
  const id = env.modelId?.trim() || DEFAULT_MODEL[provider];

  if (provider === 'google') {
    if (!env.googleApiKey) return null;
    const google = createGoogleGenerativeAI({ apiKey: env.googleApiKey });

    return {
      id,
      provider,
      languageModel: google(id) as unknown as AgentModel['languageModel'],
      maxOutputTokens: 2048,
      providerOptions: { google: { thinkingConfig: { thinkingLevel: 'low' } } },
    };
  }

  if (!env.anthropicApiKey) return null;
  const anthropic = createAnthropic({ apiKey: env.anthropicApiKey });

  return {
    id,
    provider,
    languageModel: anthropic(id) as unknown as AgentModel['languageModel'],
    maxOutputTokens: 4096,
    providerOptions: {
      anthropic: {
        effort: 'low',
        ...(ANTHROPIC_SERVER_FALLBACK.has(id)
          ? { fallbacks: 'default', anthropicBeta: ['server-side-fallback-2026-07-01'] }
          : {}),
      },
    },
  };
}

/** Lê a configuração do modelo das variáveis de ambiente (usado pelo app e pelos evals). */
export function agentModelEnv(overrides: Partial<AgentModelEnv> = {}): AgentModelEnv {
  return {
    provider: process.env.AGENT_PROVIDER,
    modelId: process.env.AGENT_MODEL,
    googleApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    ...overrides,
  };
}
