import { createAnthropic } from '@ai-sdk/anthropic';
import type { Agent } from '@mastra/core/agent';

export const AGENT_MODEL = Symbol('AGENT_MODEL');

export type AgentModel = {
  id: string;
  languageModel: ConstructorParameters<typeof Agent>[0]['model'];
  maxOutputTokens: number;
  providerOptions: Record<string, Record<string, unknown>>;
};

export const DEFAULT_AGENT_MODEL = 'claude-opus-5-5';

/** Modelos com fallback de recusa no servidor (forma "default", roteada por categoria). */
const SERVER_FALLBACK_MODELS = new Set([
  'claude-opus-5-5',
  'claude-sonnet-5-5',
  'claude-fable-5-1',
]);

/**
 * Configuração do modelo do agent. Respostas de chat são curtas, então o esforço é "low"
 * (recomendado para chat) e o teto de saída é baixo; o pensamento adaptativo fica no padrão
 * do modelo. Sem ANTHROPIC_API_KEY devolve null e o chat avisa que o assistente está indisponível.
 */
export function createAgentModel(env: { apiKey?: string; modelId?: string }): AgentModel | null {
  if (!env.apiKey) return null;

  const id = env.modelId?.trim() || DEFAULT_AGENT_MODEL;
  const anthropic = createAnthropic({ apiKey: env.apiKey });

  return {
    id,
    // O Mastra embute a própria cópia dos tipos do AI SDK; o contrato em runtime é o mesmo.
    languageModel: anthropic(id) as unknown as AgentModel['languageModel'],
    maxOutputTokens: 4096,
    providerOptions: {
      anthropic: {
        effort: 'low',
        ...(SERVER_FALLBACK_MODELS.has(id)
          ? { fallbacks: 'default', anthropicBeta: ['server-side-fallback-2026-07-01'] }
          : {}),
      },
    },
  };
}
