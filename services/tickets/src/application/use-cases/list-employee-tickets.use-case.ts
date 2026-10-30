import { Inject, Injectable } from '@nestjs/common';

import { type TicketView, toTicketView } from '../ticket-view';
import { CLOCK, type Clock } from '../ports/clock.port';
import {
  TICKET_REPOSITORY,
  type TicketRepository,
  type TicketScope,
} from '../ports/ticket-repository.port';

type ListEmployeeTicketsInput = {
  employeeId: string;
  scope: TicketScope;
};

@Injectable()
export class ListEmployeeTicketsUseCase {
  constructor(
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ employeeId, scope }: ListEmployeeTicketsInput): Promise<TicketView[]> {
    const now = this.clock.now();
    const tickets = await this.tickets.findByRequester(employeeId, scope, now);

    return tickets.map((ticket) => toTicketView(ticket, now));
  }
}
