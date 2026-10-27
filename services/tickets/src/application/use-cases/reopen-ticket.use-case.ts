import { Inject, Injectable } from '@nestjs/common';

import type { TicketUpdateAuthor } from '@/domain/entities/ticket.entity';
import { CLOCK, type Clock } from '../ports/clock.port';
import { TICKET_REPOSITORY, type TicketRepository } from '../ports/ticket-repository.port';
import { type TicketView, toTicketView } from '../ticket-view';
import { findOwnedTicket } from './find-owned-ticket';

type ReopenTicketInput = {
  employeeId: string;
  ticketId: string;
  reason: string;
  author: TicketUpdateAuthor;
};

@Injectable()
export class ReopenTicketUseCase {
  constructor(
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(input: ReopenTicketInput): Promise<TicketView> {
    const now = this.clock.now();
    const current = await findOwnedTicket(this.tickets, input.employeeId, input.ticketId);

    const { ticket, update } = current.reopen({ author: input.author, reason: input.reason }, now);

    await this.tickets.save(ticket, update);

    return toTicketView(ticket, now);
  }
}
