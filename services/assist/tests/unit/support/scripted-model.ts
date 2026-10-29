import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';

import type { AgentModel } from '@/infrastructure/agent/model';

export type ScriptedStep =
  | { tools: { name: string; input: Record<string, unknown> }[] }
  | { text: string };

/**
 * Modelo falso para o Mastra: cada chamada ao modelo devolve o próximo passo do roteiro
 * (chamadas de tool ou texto final), em streaming, como o provider real faria.
 */
export function scriptedModel(script: ScriptedStep[]): { model: AgentModel; calls: () => number } {
  let call = 0;

  const mock = new MastraLanguageModelV2Mock({
    modelId: 'scripted',
    doStream: async () => {
      const step = script[Math.min(call, script.length - 1)];
      call += 1;

      const parts: unknown[] = [{ type: 'stream-start', warnings: [] }];

      if (step && 'tools' in step) {
        step.tools.forEach((tool, index) => {
          parts.push({
            type: 'tool-call',
            toolCallId: `call-${call}-${index}`,
            toolName: tool.name,
            input: JSON.stringify(tool.input),
          });
        });
        parts.push({
          type: 'finish',
          finishReason: 'tool-calls',
          usage: { inputTokens: 900, outputTokens: 60, totalTokens: 960 },
        });
      } else {
        parts.push({ type: 'text-start', id: 't1' });
        for (const word of (step?.text ?? '').split(/(?<= )/)) {
          parts.push({ type: 'text-delta', id: 't1', delta: word });
        }
        parts.push({ type: 'text-end', id: 't1' });
        parts.push({
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1000, outputTokens: 40, totalTokens: 1040 },
        });
      }

      return {
        stream: new ReadableStream({
          start(controller) {
            for (const part of parts) controller.enqueue(part);
            controller.close();
          },
        }),
      } as never;
    },
  });

  return {
    calls: () => call,
    model: {
      id: 'scripted',
      provider: 'google',
      languageModel: mock as unknown as AgentModel['languageModel'],
      maxOutputTokens: 1024,
      providerOptions: {},
    },
  };
}

/** Modelo que nunca responde (como um provedor travado); só termina quando o turno é abortado. */
export function hangingModel(): AgentModel {
  const mock = new MastraLanguageModelV2Mock({
    modelId: 'hanging',
    doStream: (options) =>
      new Promise((_, reject) => {
        options.abortSignal?.addEventListener('abort', () => reject(options.abortSignal?.reason));
      }),
  });

  return {
    id: 'hanging',
    provider: 'google',
    languageModel: mock as unknown as AgentModel['languageModel'],
    maxOutputTokens: 1024,
    providerOptions: {},
  };
}
