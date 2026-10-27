import type { TicketCategory, TicketImpact, TicketPriority, TicketType } from '@nexo/shared';
import { Inject, Injectable } from '@nestjs/common';

import { TicketEntity, type TicketUpdateAuthor } from '@/domain/entities/ticket.entity';
import { CLOCK, type Clock } from '../ports/clock.port';
import { TICKET_REPOSITORY, type TicketRepository } from '../ports/ticket-repository.port';
import { type TicketView, toTicketView } from '../ticket-view';

export type CreateTicketInput = {
  employeeId: string;
  type: TicketType;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  impact: TicketImpact;
  author: TicketUpdateAuthor;
};

@Injectable()
export class CreateTicketUseCase {
  constructor(
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(input: CreateTicketInput): Promise<TicketView> {
    const now = this.clock.now();
    const id = await this.tickets.nextId(input.type);

    const { ticket, update } = TicketEntity.create(
      {
        id,
        type: input.type,
        title: input.title,
        description: input.description,
        category: input.category,
        priority: input.priority,
        impact: input.impact,
        requesterId: input.employeeId,
        author: input.author,
      },
      now,
    );

    await this.tickets.save(ticket, update);

    return toTicketView(ticket, now);
  }
}
