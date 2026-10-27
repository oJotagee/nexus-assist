import { Inject, Injectable } from '@nestjs/common';

import type { SupportGroup } from '@/domain/entities/ticket.entity';
import { CLOCK, type Clock } from '../ports/clock.port';
import { TICKET_REPOSITORY, type TicketRepository } from '../ports/ticket-repository.port';
import { type TicketView, toTicketView } from '../ticket-view';
import { findOwnedTicket } from './find-owned-ticket';

type TransferTicketInput = {
  employeeId: string;
  ticketId: string;
  group: SupportGroup;
  summary: string;
};

@Injectable()
export class TransferTicketUseCase {
  constructor(
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(input: TransferTicketInput): Promise<TicketView> {
    const now = this.clock.now();
    const current = await findOwnedTicket(this.tickets, input.employeeId, input.ticketId);

    const { ticket, update } = current.transfer(
      { group: input.group, summary: input.summary },
      now,
    );

    await this.tickets.save(ticket, update);

    return toTicketView(ticket, now);
  }
}
