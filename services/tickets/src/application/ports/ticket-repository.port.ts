import type { TicketType } from '@nexo/shared';

import type { TicketEntity, TicketUpdate } from '@/domain/entities/ticket.entity';

export const TICKET_REPOSITORY = Symbol('TICKET_REPOSITORY');

/**
 * open: ainda na fila · recent: abertos + resolvidos/fechados nos últimos 30 dias · all: tudo
 */
export type TicketScope = 'open' | 'recent' | 'all';

export interface TicketRepository {
  findById(id: string): Promise<TicketEntity | null>;
  findByRequester(requesterId: string, scope: TicketScope, now: Date): Promise<TicketEntity[]>;
  findUpdates(ticketId: string): Promise<TicketUpdate[]>;
  /** Reserva o próximo identificador do tipo (INC-20341, REQ-10502...). */
  nextId(type: TicketType): Promise<string>;
  /** Grava o chamado e o registro de histórico na mesma transação. */
  save(ticket: TicketEntity, update: TicketUpdate): Promise<void>;
}
