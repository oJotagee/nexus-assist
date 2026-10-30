import { describe, expect, it } from 'bun:test';

import { NOW, at, buildTicket } from '@tests/unit/support/builders';
import { TicketEntity } from '@/domain/entities/ticket.entity';
import {
  InvalidTicketError,
  TicketCannotBeReopenedError,
  TicketClosedError,
} from '@/domain/errors/ticket.error';

describe('TicketEntity', () => {
  describe('create', () => {
    it('abre o chamado na fila do Suporte N1 e registra o histórico', () => {
      const { ticket, update } = TicketEntity.create(
        {
          id: 'INC-20341',
          type: 'INC',
          title: '  VPN não conecta — erro 809  ',
          description: 'Windows 11, reunião às 14h.',
          category: 'NETWORK_VPN',
          priority: 'HIGH',
          impact: 'SELF',
          requesterId: 'emp_ana',
          author: 'AGENT',
        },
        NOW,
      );

      expect(ticket.status).toBe('OPEN');
      expect(ticket.title).toBe('VPN não conecta — erro 809');
      expect(ticket.assignedGroup).toBe('Suporte N1');
      expect(ticket.lastUpdateAt).toEqual(NOW);
      expect(update).toMatchObject({ kind: 'CREATED', author: 'AGENT' });
    });

    it('rejeita prefixo que não bate com o tipo', () => {
      expect(() => buildTicket({ id: 'REQ-1', type: 'INC' })).toThrow(InvalidTicketError);
    });

    it.each([
      ['título vazio', { title: '' }],
      ['título longo', { title: 'x'.repeat(121) }],
      ['descrição vazia', { description: '' }],
      ['id fora do padrão', { id: 'INC20311' }],
    ])('rejeita %s', (_, overrides) => {
      expect(() => buildTicket(overrides)).toThrow(InvalidTicketError);
    });
  });

  describe('deadline', () => {
    it('INC-20311 parado há 6 dias está vencido', () => {
      expect(buildTicket().deadline(NOW).overdue).toBe(true);
    });
  });

  describe('addComment', () => {
    it('reinicia o prazo a partir da atualização', () => {
      const { ticket, update } = buildTicket().addComment(
        { author: 'REQUESTER', authorName: null, body: 'Continua lento.' },
        NOW,
      );

      expect(ticket.lastUpdateAt).toEqual(NOW);
      expect(ticket.deadline(NOW).overdue).toBe(false);
      expect(update).toMatchObject({ kind: 'COMMENT', body: 'Continua lento.' });
    });

    it('não aceita atualização vazia', () => {
      expect(() =>
        buildTicket().addComment({ author: 'AGENT', authorName: null, body: '   ' }, NOW),
      ).toThrow(InvalidTicketError);
    });

    it('não complementa chamado encerrado', () => {
      const resolved = buildTicket({ status: 'RESOLVED', resolvedAt: at('2026-10-25T10:00:00') });

      expect(() =>
        resolved.addComment({ author: 'AGENT', authorName: null, body: 'oi' }, NOW),
      ).toThrow(TicketClosedError);
    });
  });

  describe('reopen', () => {
    it('reabre chamado resolvido há até 7 dias', () => {
      const resolved = buildTicket({
        id: 'INC-20150',
        status: 'RESOLVED',
        resolvedAt: at('2026-10-23T10:00:00'),
      });

      const { ticket, update } = resolved.reopen(
        { author: 'AGENT', reason: 'Bloqueou de novo.' },
        NOW,
      );

      expect(ticket.status).toBe('OPEN');
      expect(ticket.resolvedAt).toBeNull();
      expect(update).toMatchObject({ kind: 'REOPENED', body: 'Bloqueou de novo.' });
    });

    it('recusa chamado resolvido há mais de 7 dias', () => {
      const old = buildTicket({ status: 'RESOLVED', resolvedAt: at('2026-10-07T10:00:00') });

      expect(() => old.reopen({ author: 'AGENT', reason: 'x' }, NOW)).toThrow(
        TicketCannotBeReopenedError,
      );
    });

    it('recusa chamado ainda aberto', () => {
      expect(() => buildTicket().reopen({ author: 'AGENT', reason: 'x' }, NOW)).toThrow(
        TicketCannotBeReopenedError,
      );
    });
  });

  describe('transfer', () => {
    it('coloca na fila do grupo com o resumo no histórico', () => {
      const { ticket, update } = buildTicket().transfer(
        { group: 'N2', summary: 'Prazo vencido, funcionária pediu analista.' },
        NOW,
      );

      expect(ticket.status).toBe('WAITING_ANALYST');
      expect(ticket.assignedGroup).toBe('Suporte N2');
      expect(update.kind).toBe('TRANSFERRED');
      expect(update.body).toContain('Suporte N2');
      expect(update.body).toContain('Prazo vencido');
    });

    it('não transfere chamado fechado', () => {
      const closed = buildTicket({ status: 'CLOSED', resolvedAt: at('2026-10-01T10:00:00') });

      expect(() => closed.transfer({ group: 'N1', summary: 'x' }, NOW)).toThrow(TicketClosedError);
    });
  });

  describe('close', () => {
    it('resolvido pelo funcionário: fica reabrível por 7 dias', () => {
      const { ticket, update } = buildTicket().close(
        { resolution: 'RESOLVED', reason: 'Confirmou que resolveu.', author: 'AGENT' },
        NOW,
      );

      expect(ticket.status).toBe('RESOLVED');
      expect(ticket.resolvedAt).toEqual(NOW);
      expect(ticket.canReopen(NOW)).toBe(true);
      expect(update).toMatchObject({ kind: 'STATUS_CHANGED', body: 'Confirmou que resolveu.' });
    });

    it('resolvido pelo analista: o nome dele fica no histórico', () => {
      const { update } = buildTicket().close(
        {
          resolution: 'RESOLVED',
          reason: 'Perfil da VPN reinstalado.',
          author: 'ANALYST',
          authorName: 'Rafael Lima',
        },
        NOW,
      );

      expect(update).toMatchObject({ author: 'ANALYST', authorName: 'Rafael Lima' });
    });

    it('cancelado: fecha sem resolução e não é reabrível', () => {
      const { ticket } = buildTicket().close(
        { resolution: 'CANCELLED', reason: 'Substituído por outro chamado.', author: 'AGENT' },
        NOW,
      );

      expect(ticket.status).toBe('CLOSED');
      expect(ticket.canReopen(NOW)).toBe(false);
    });

    it('não fecha o que já está encerrado', () => {
      const resolved = buildTicket({ status: 'RESOLVED', resolvedAt: at('2026-10-26T10:00:00') });
      expect(() =>
        resolved.close({ resolution: 'CANCELLED', reason: 'x', author: 'AGENT' }, NOW),
      ).toThrow(TicketClosedError);
    });
  });
});
