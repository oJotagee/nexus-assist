import { beforeEach, describe, expect, it } from 'bun:test';
import type { ConsoleConversationItemDto } from '@nexo/shared';
import { renderHook } from '@testing-library/react';

import { resetNextMocks, toast } from '../support/next';

const { useConsoleActivity } = await import(
  '@/app/(analyst)/console/_components/use-console-activity'
);

const item = (
  id: string,
  overrides: Partial<ConsoleConversationItemDto> = {},
): ConsoleConversationItemDto => ({
  id,
  employee: { id: `emp_${id}`, name: `Pessoa ${id}`, department: 'TI' },
  state: 'AGENT',
  handoffReason: null,
  handoffAt: null,
  assignedAnalyst: null,
  resolvedByAgent: false,
  lastMessage: { author: 'EMPLOYEE', text: 'oi', createdAt: '2026-10-29T10:00:00.000Z' },
  focusTicketId: null,
  ...overrides,
});

describe('useConsoleActivity', () => {
  beforeEach(() => {
    resetNextMocks();
    window.localStorage.clear();
  });

  it('na primeira visita nada é novidade; mensagem nova depois disso é', () => {
    const { result, rerender } = renderHook(({ items }) => useConsoleActivity(items), {
      initialProps: { items: [item('a'), item('b')] },
    });
    expect(result.current.unreadCount).toBe(0);

    rerender({
      items: [
        item('a'),
        item('b', {
          lastMessage: {
            author: 'EMPLOYEE',
            text: 'outra coisa',
            createdAt: '2026-10-29T11:00:00.000Z',
          },
        }),
      ],
    });

    expect(
      result.current.isUnread(
        item('b', {
          lastMessage: {
            author: 'EMPLOYEE',
            text: 'outra coisa',
            createdAt: '2026-10-29T11:00:00.000Z',
          },
        }),
      ),
    ).toBe(true);
    expect(result.current.unreadCount).toBe(1);
    expect(document.title).toStartWith('(1)');
  });

  it('a conversa aberta é marcada como vista e mensagem do próprio analista não conta', () => {
    const newer = {
      author: 'EMPLOYEE' as const,
      text: 'nova',
      createdAt: '2026-10-29T12:00:00.000Z',
    };
    const { result, rerender } = renderHook(({ items, open }) => useConsoleActivity(items, open), {
      initialProps: { items: [item('a')], open: undefined as string | undefined },
    });

    rerender({ items: [item('a', { lastMessage: newer })], open: 'a' });
    expect(result.current.unreadCount).toBe(0);

    rerender({
      items: [
        item('a', {
          lastMessage: { ...newer, author: 'ANALYST', createdAt: '2026-10-29T13:00:00.000Z' },
        }),
      ],
      open: undefined,
    });
    expect(result.current.unreadCount).toBe(0);
  });

  it('avisa quando uma conversa entra na fila de atendimento', () => {
    const { rerender } = renderHook(({ items }) => useConsoleActivity(items), {
      initialProps: { items: [item('a')] },
    });

    rerender({ items: [item('a', { state: 'WAITING_ANALYST', handoffReason: 'USER_REQUESTED' })] });

    expect(toast.info).toHaveBeenCalledWith('Pessoa a está esperando um atendente', {
      id: 'waiting-a',
    });
  });
});
