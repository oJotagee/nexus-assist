import { Inject, Injectable } from '@nestjs/common';

import { TICKET_REPOSITORY, type TicketRepository } from '../ports/ticket-repository.port';
import { type TicketDetailView, toTicketView } from '../ticket-view';
import { CLOCK, type Clock } from '../ports/clock.port';
import { findOwnedTicket } from './find-owned-ticket';

type GetEmployeeTicketInput = {
  employeeId: string;
  ticketId: string;
};

@Injectable()
export class GetEmployeeTicketUseCase {
  constructor(
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ employeeId, ticketId }: GetEmployeeTicketInput): Promise<TicketDetailView> {
    const ticket = await findOwnedTicket(this.tickets, employeeId, ticketId);
    const updates = await this.tickets.findUpdates(ticket.id);

    return { ...toTicketView(ticket, this.clock.now()), updates };
  }
}
