import { SESSION_MESSAGE_LIMIT } from '@nexo/shared';
import { describe, expect, it } from 'bun:test';

import { TicketDraftEntity } from '@/domain/entities/ticket-draft.entity';
import {
  DraftNotPendingError,
  InvalidDraftError,
  SessionLimitReachedError,
} from '@/domain/errors/domain.error';
import { assertCanSend } from '@/domain/policies/session-limit';
import { NOW, at } from '@tests/unit/support/in-memory';

const draft = (overrides: Partial<Parameters<typeof TicketDraftEntity.create>[0]> = {}) =>
  TicketDraftEntity.create(
    {
      id: 'd1',
      conversationId: 'c1',
      mode: 'CREATE',
      targetTicketId: null,
      type: 'INC',
      title: 'VPN não conecta no notebook — erro 809',
      description: 'Windows 11; reunião com cliente às 14h.',
      category: 'NETWORK_VPN',
      priority: 'HIGH',
      priorityRule: 'Alta: há um compromisso no mesmo dia',
      impact: 'SELF',
      idempotencyKey: 'key-1',
      ...overrides,
    },
    NOW,
  );

describe('TicketDraftEntity', () => {
  it('calcula o prazo a partir da prioridade', () => {
    expect(draft().toSnapshot().dueAt).toEqual(at('2026-10-27T14:00:00'));
  });

  it('atualizar ou reabrir exige o chamado de destino', () => {
    expect(() => draft({ mode: 'UPDATE' })).toThrow(InvalidDraftError);
    expect(draft({ mode: 'REOPEN', targetTicketId: 'INC-20150' }).mode).toBe('REOPEN');
  });

  it('mudar a prioridade no rascunho recalcula o prazo e registra o motivo', () => {
    const edited = draft().edit({ priority: 'MEDIUM' }, NOW).toSnapshot();

    expect(edited.priority).toBe('MEDIUM');
    expect(edited.priorityRule).toContain('ajustada pelo funcionário');
    expect(edited.dueAt).toEqual(at('2026-10-30T10:00:00'));
  });

  it('editar o título mantém a regra de prioridade original', () => {
    const edited = draft().edit({ title: 'VPN erro 809' }, NOW).toSnapshot();

    expect(edited.title).toBe('VPN erro 809');
    expect(edited.priorityRule).toBe('Alta: há um compromisso no mesmo dia');
  });

  it('só confirma ou cancela uma vez', () => {
    const confirmed = draft().confirm('INC-20341');

    expect(confirmed.toSnapshot()).toMatchObject({
      status: 'CONFIRMED',
      resultTicketId: 'INC-20341',
    });
    expect(() => confirmed.confirm('INC-20342')).toThrow(DraftNotPendingError);
    expect(() => confirmed.cancel()).toThrow(DraftNotPendingError);
    expect(() => draft().cancel().edit({ title: 'x' }, NOW)).toThrow(DraftNotPendingError);
  });
});

describe('limite de mensagens da sessão', () => {
  const session = (messageCount: number) => ({
    id: 's1',
    conversationId: 'c1',
    index: 0,
    messageCount,
    summary: null,
    startedAt: NOW,
  });

  it('aceita enquanto couber a resposta do agent', () => {
    expect(() => assertCanSend(session(SESSION_MESSAGE_LIMIT - 2), true)).not.toThrow();
  });

  it('recusa a mensagem que ficaria sem resposta', () => {
    expect(() => assertCanSend(session(SESSION_MESSAGE_LIMIT - 1), true)).toThrow(
      SessionLimitReachedError,
    );
  });

  it('com analista, cada mensagem ocupa uma posição só', () => {
    expect(() => assertCanSend(session(SESSION_MESSAGE_LIMIT - 1), false)).not.toThrow();
    expect(() => assertCanSend(session(SESSION_MESSAGE_LIMIT), false)).toThrow(
      SessionLimitReachedError,
    );
  });
});
