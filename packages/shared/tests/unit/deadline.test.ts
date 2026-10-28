import { describe, expect, it } from 'bun:test';

import { canReopen, computeDueAt, formatDueAt, getTicketDeadline } from '../../src/sla';

const at = (iso: string) => new Date(`${iso}-03:00`);
const NOW = at('2026-10-27T10:00:00');

describe('computeDueAt', () => {
  it('Crítica: 1 hora corrida, mesmo fora do expediente', () => {
    expect(computeDueAt('CRITICAL', at('2026-10-31T03:00:00'))).toEqual(at('2026-10-31T04:00:00'));
  });

  it('Alta: 4 horas úteis', () => {
    expect(computeDueAt('HIGH', at('2026-10-27T09:45:00'))).toEqual(at('2026-10-27T13:45:00'));
  });

  it('Média: 3 dias úteis', () => {
    expect(computeDueAt('MEDIUM', at('2026-10-27T10:00:00'))).toEqual(at('2026-10-30T10:00:00'));
  });

  it('Baixa: 5 dias úteis', () => {
    expect(computeDueAt('LOW', at('2026-10-27T10:00:00'))).toEqual(at('2026-11-03T10:00:00'));
  });
});

describe('getTicketDeadline', () => {
  it('chamado médio parado há 6 dias está vencido (INC-20311)', () => {
    const deadline = getTicketDeadline(
      { priority: 'MEDIUM', status: 'WAITING_ANALYST', lastUpdateAt: at('2026-10-21T10:00:00') },
      NOW,
    );

    expect(deadline.overdue).toBe(true);
    expect(deadline.dueAt).toEqual(at('2026-10-26T10:00:00'));
    expect(deadline.slaLabel).toBe('3 dias úteis');
  });

  it('chamado atualizado ontem está em dia', () => {
    const deadline = getTicketDeadline(
      { priority: 'MEDIUM', status: 'IN_PROGRESS', lastUpdateAt: at('2026-10-26T10:00:00') },
      NOW,
    );

    expect(deadline.overdue).toBe(false);
  });

  it('chamado resolvido não tem prazo', () => {
    const deadline = getTicketDeadline(
      { priority: 'MEDIUM', status: 'RESOLVED', lastUpdateAt: at('2026-10-01T10:00:00') },
      NOW,
    );

    expect(deadline).toEqual({ dueAt: null, overdue: false, slaLabel: '3 dias úteis' });
  });

  it('chamado aguardando o funcionário não vence', () => {
    const deadline = getTicketDeadline(
      { priority: 'HIGH', status: 'WAITING_REQUESTER', lastUpdateAt: at('2026-10-01T10:00:00') },
      NOW,
    );

    expect(deadline.overdue).toBe(false);
    expect(deadline.dueAt).toBeNull();
  });
});

describe('canReopen', () => {
  it('reabre chamado resolvido há 4 dias (INC-20150)', () => {
    expect(canReopen({ status: 'RESOLVED', resolvedAt: at('2026-10-23T10:00:00') }, NOW)).toBe(
      true,
    );
  });

  it('não reabre chamado resolvido há mais de 7 dias', () => {
    expect(canReopen({ status: 'RESOLVED', resolvedAt: at('2026-10-19T09:00:00') }, NOW)).toBe(
      false,
    );
  });

  it('não reabre chamado fechado ou ainda aberto', () => {
    expect(canReopen({ status: 'CLOSED', resolvedAt: at('2026-10-26T10:00:00') }, NOW)).toBe(false);
    expect(canReopen({ status: 'OPEN', resolvedAt: null }, NOW)).toBe(false);
  });
});

describe('formatDueAt', () => {
  it('usa "hoje", "amanhã" ou a data, em horário de Brasília', () => {
    expect(formatDueAt(at('2026-10-27T13:45:00'), NOW)).toBe('hoje às 13h45');
    expect(formatDueAt(at('2026-10-28T09:00:00'), NOW)).toBe('amanhã às 09h00');
    expect(formatDueAt(at('2026-10-30T10:00:00'), NOW)).toBe('30/10 às 10h00');
  });
});
