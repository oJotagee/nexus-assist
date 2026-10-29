import { afterEach, describe, expect, it } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';

import { buildConversation } from '../support/builders';
import '../support/next';

const { useAgentStream, CONVERSATION_QUERY_KEY } = await import(
  '@/app/(employee)/atendimento/_hooks/use-agent-stream'
);

const originalFetch = globalThis.fetch;

function sse(events: object[]): Response {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
}

function setup() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(CONVERSATION_QUERY_KEY, buildConversation({ state: 'WITH_ANALYST' }));
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...renderHook(() => useAgentStream('conv-1'), { wrapper }) };
}

const employeeMessage = {
  id: 'm1',
  author: 'EMPLOYEE',
  authorName: 'Ana',
  text: 'oi',
  blocks: [],
  createdAt: new Date().toISOString(),
  trace: null,
};

describe('useAgentStream', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('mostra a resposta do agent quando o servidor diz que ele vai responder, mesmo com o cache desatualizado', async () => {
    const steps: number[] = [];
    let resolveSecond: (() => void) | null = null;
    globalThis.fetch = (async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            const enc = new TextEncoder();
            controller.enqueue(
              enc.encode(
                `data: ${JSON.stringify({ type: 'message', message: employeeMessage, agentWillReply: true })}\n\n`,
              ),
            );
            resolveSecond = () => {
              controller.enqueue(
                enc.encode(
                  `data: ${JSON.stringify({ type: 'done', message: null, conversation: buildConversation({ state: 'AGENT' }) })}\n\n`,
                ),
              );
              controller.close();
            };
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } },
      )) as unknown as typeof fetch;

    const { result, queryClient } = setup();
    let sending: Promise<boolean> = Promise.resolve(false);
    await act(async () => {
      sending = result.current.send({ text: 'oi' });
      await Bun.sleep(20);
    });
    steps.push(result.current.live ? 1 : 0);

    await act(async () => {
      resolveSecond?.();
      await sending;
    });

    expect(steps).toEqual([1]);
    expect(queryClient.getQueryData<{ state: string }>(CONVERSATION_QUERY_KEY)?.state).toBe(
      'AGENT',
    );
  });

  it('com o agent pausado (analista), não mostra resposta "digitando"', async () => {
    globalThis.fetch = (async () =>
      sse([
        { type: 'message', message: employeeMessage, agentWillReply: false },
        { type: 'done', message: null, conversation: buildConversation({ state: 'WITH_ANALYST' }) },
      ])) as unknown as typeof fetch;

    const { result } = setup();
    let sawLive = false;
    await act(async () => {
      const promise = result.current.send({ text: 'oi' });
      await Bun.sleep(5);
      sawLive = result.current.live !== null;
      await promise;
    });

    expect(sawLive).toBe(false);
  });
});
