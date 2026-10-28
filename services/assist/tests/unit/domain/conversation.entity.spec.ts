import { describe, expect, it } from 'bun:test';

import { ConversationEntity } from '@/domain/entities/conversation.entity';
import {
  InvalidConversationTransitionError,
  NotAssignedAnalystError,
} from '@/domain/errors/domain.error';
import { NOW } from '@tests/unit/support/in-memory';

const start = () => ConversationEntity.start({ id: 'c1', employeeId: 'emp_ana' }, NOW);
const handoff = { reason: 'OVERDUE' as const, summary: 'INC-20311 vencido.', group: 'N2' as const };

describe('ConversationEntity (máquina de estados)', () => {
  it('começa com o agent respondendo', () => {
    expect(start().state).toBe('AGENT');
    expect(start().agentCanReply()).toBe(true);
  });

  it('transferência pausa o agent e guarda o resumo', () => {
    const waiting = start().handOff(handoff, NOW);

    expect(waiting.state).toBe('WAITING_ANALYST');
    expect(waiting.agentCanReply()).toBe(false);
    expect(waiting.toSnapshot()).toMatchObject({
      handoffReason: 'OVERDUE',
      handoffSummary: 'INC-20311 vencido.',
      handoffGroup: 'N2',
      handoffAt: NOW,
    });
  });

  it('não transfere duas vezes', () => {
    expect(() => start().handOff(handoff, NOW).handOff(handoff, NOW)).toThrow(
      InvalidConversationTransitionError,
    );
  });

  it('analista assume, o agent continua pausado e só ele responde', () => {
    const assumed = start().handOff(handoff, NOW).assume('emp_rafael', NOW);

    expect(assumed.state).toBe('WITH_ANALYST');
    expect(assumed.agentCanReply()).toBe(false);
    expect(() => assumed.assertCanAnalystReply('emp_rafael')).not.toThrow();
    expect(() => assumed.assertCanAnalystReply('emp_julia')).toThrow(NotAssignedAnalystError);
  });

  it('outro analista não toma uma conversa já assumida', () => {
    const assumed = start().assume('emp_rafael', NOW);

    expect(() => assumed.assume('emp_julia', NOW)).toThrow(InvalidConversationTransitionError);
    expect(() => assumed.releaseToAgent('emp_julia', NOW)).toThrow(NotAssignedAnalystError);
  });

  it('devolver ao agent limpa a transferência', () => {
    const released = start()
      .handOff(handoff, NOW)
      .assume('emp_rafael', NOW)
      .releaseToAgent('emp_rafael', NOW);

    expect(released.state).toBe('AGENT');
    expect(released.assignedAnalystId).toBeNull();
    expect(released.toSnapshot().handoffReason).toBeNull();
  });

  it('pode devolver direto da fila, sem assumir', () => {
    expect(start().handOff(handoff, NOW).releaseToAgent('emp_rafael', NOW).state).toBe('AGENT');
  });

  it('encerrar e depois o funcionário escrever reabre com o agent', () => {
    const closed = start().assume('emp_rafael', NOW).close('emp_rafael', NOW);
    expect(closed.state).toBe('CLOSED');

    const reopened = closed.receiveEmployeeMessage(NOW);
    expect(reopened.state).toBe('AGENT');
    expect(reopened.assignedAnalystId).toBeNull();
  });

  it('não devolve nem encerra uma conversa que não está com analista', () => {
    expect(() => start().releaseToAgent('emp_rafael', NOW)).toThrow(
      InvalidConversationTransitionError,
    );
    expect(() => start().close('emp_rafael', NOW).close('emp_rafael', NOW)).toThrow(
      InvalidConversationTransitionError,
    );
  });
});
