'use client';

import type { ConversationDto, MessageBlock, TraceStep } from '@nexo/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { readAgentStream } from '@/lib/sse';

export const CONVERSATION_QUERY_KEY = ['conversation', 'active'] as const;

export type LiveTurn = { steps: TraceStep[]; text: string; blocks: MessageBlock[] };

export type SendInput = {
  text: string;
  reply?: { messageId: string; kind: 'QUICK_REPLY' | 'TICKET_PICKER'; value: string };
};

type StreamError = { message: string; code: string | null; failedText: string | null };

/**
 * Envia a mensagem e acompanha a resposta do agent em tempo real: passos (trail ao vivo),
 * texto token a token e blocos. O resultado final substitui o cache do React Query.
 */
export function useAgentStream(conversationId: string) {
  const queryClient = useQueryClient();
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [live, setLive] = useState<LiveTurn | null>(null);
  const [error, setError] = useState<StreamError | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async ({ text, reply }: SendInput): Promise<boolean> => {
      if (isStreaming) return false;

      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);
      setError(null);
      setPendingText(text);
      let delivered = false;

      try {
        const response = await fetch(
          `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, reply }),
            signal: controller.signal,
          },
        );

        if (!response.ok || !response.body) {
          const body = (await response.json().catch(() => null)) as {
            message?: string | string[];
            error?: string;
          } | null;
          const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
          throw Object.assign(new Error(message ?? 'Não foi possível enviar a mensagem.'), {
            code: body?.error ?? null,
          });
        }

        await readAgentStream(response.body, (event) => {
          switch (event.type) {
            case 'message':
              delivered = true;
              setPendingText(null);
              queryClient.setQueryData<ConversationDto>(CONVERSATION_QUERY_KEY, (current) =>
                current
                  ? {
                      ...current,
                      messages: [...current.messages, event.message],
                      session: {
                        ...current.session,
                        messageCount: current.session.messageCount + 1,
                      },
                    }
                  : current,
              );
              setLive({ steps: [], text: '', blocks: [] });
              break;
            case 'step':
              setLive((turn) => {
                const base = turn ?? { steps: [], text: '', blocks: [] };
                const exists = base.steps.some((step) => step.id === event.step.id);
                return {
                  ...base,
                  steps: exists
                    ? base.steps.map((step) => (step.id === event.step.id ? event.step : step))
                    : [...base.steps, event.step],
                };
              });
              break;
            case 'text-delta':
              setLive((turn) => ({
                ...(turn ?? { steps: [], blocks: [] }),
                text: (turn?.text ?? '') + event.delta,
              }));
              break;
            case 'block':
              setLive((turn) => {
                const base = turn ?? { steps: [], text: '', blocks: [] };
                return {
                  ...base,
                  blocks: [
                    ...base.blocks.filter((block) => block.type !== event.block.type),
                    event.block,
                  ],
                };
              });
              break;
            case 'done':
              queryClient.setQueryData(CONVERSATION_QUERY_KEY, event.conversation);
              setLive(null);
              break;
            case 'error':
              throw Object.assign(new Error(event.message), { code: event.error });
          }
        });

        return true;
      } catch (caught) {
        if (controller.signal.aborted) return false;
        const code = (caught as { code?: string | null }).code ?? null;
        setError({
          message: caught instanceof Error ? caught.message : 'Não foi possível enviar a mensagem.',
          code,
          // Se a mensagem nem chegou ao servidor, devolve o texto para o funcionário tentar de novo.
          failedText: delivered ? null : text,
        });
        await queryClient.invalidateQueries({ queryKey: CONVERSATION_QUERY_KEY });
        return false;
      } finally {
        setPendingText(null);
        setLive(null);
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [conversationId, isStreaming, queryClient],
  );

  return { send, pendingText, live, error, clearError: () => setError(null), isStreaming };
}
