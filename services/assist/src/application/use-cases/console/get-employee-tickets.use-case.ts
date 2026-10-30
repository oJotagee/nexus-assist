import type { TicketSummaryDto } from '@nexo/shared';
import { Inject, Injectable } from '@nestjs/common';

import { TICKETS_GATEWAY, type TicketsGateway } from '../../ports/tickets-gateway.port';
import { ConversationNotFoundError } from '@/domain/errors/domain.error';
import { toTicketSummary } from '../../presenters';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from '../../ports/repositories.port';

/**
 * Painel "Chamados da Ana" no console. O analista só chega aos chamados de quem está na
 * conversa que ele abriu; não há busca livre por funcionário.
 */
@Injectable()
export class GetEmployeeTicketsUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(TICKETS_GATEWAY) private readonly tickets: TicketsGateway,
  ) {}

  async execute(conversationId: string): Promise<TicketSummaryDto[]> {
    const conversation = await this.conversations.findById(conversationId);
    if (!conversation) throw new ConversationNotFoundError();

    const { data } = await this.tickets.list(conversation.employeeId, 'all');

    return data.map(toTicketSummary);
  }
}
