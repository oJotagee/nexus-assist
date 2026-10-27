import { Inject, Injectable } from '@nestjs/common';

import type { TicketUpdateAuthor } from '@/domain/entities/ticket.entity';
import { CLOCK, type Clock } from '../ports/clock.port';
import { TICKET_REPOSITORY, type TicketRepository } from '../ports/ticket-repository.port';
import { type TicketView, toTicketView } from '../ticket-view';
import { findOwnedTicket } from './find-owned-ticket';

type AddTicketUpdateInput = {
  employeeId: string;
  ticketId: string;
  body: string;
  author: TicketUpdateAuthor;
  authorName?: string;
};

@Injectable()
export class AddTicketUpdateUseCase {
  constructor(
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(input: AddTicketUpdateInput): Promise<TicketView> {
    const now = this.clock.now();
    const current = await findOwnedTicket(this.tickets, input.employeeId, input.ticketId);

    const { ticket, update } = current.addComment(
      { author: input.author, authorName: input.authorName ?? null, body: input.body },
      now,
    );

    await this.tickets.save(ticket, update);

    return toTicketView(ticket, now);
  }
}
