import type { DecisionTraceDto } from '@nexo/shared';
import { Inject, Injectable } from '@nestjs/common';

import { TraceNotFoundError } from '@/domain/errors/domain.error';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
  MESSAGE_REPOSITORY,
  type MessageRepository,
} from '../../ports/repositories.port';
import { toTraceDto } from '../../presenters';

type GetTraceInput = {
  messageId: string;
  requester: { id: string; role: 'EMPLOYEE' | 'ANALYST' };
};

/** Detalhe completo da decisão. Funcionário só vê das próprias conversas; analista vê todas. */
@Injectable()
export class GetTraceUseCase {
  constructor(
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepository,
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
  ) {}

  async execute({ messageId, requester }: GetTraceInput): Promise<DecisionTraceDto> {
    const message = await this.messages.findById(messageId);
    if (!message) throw new TraceNotFoundError();

    if (requester.role !== 'ANALYST') {
      const conversation = await this.conversations.findById(message.conversationId);
      if (!conversation?.isOwnedBy(requester.id)) throw new TraceNotFoundError();
    }

    const trace = await this.messages.findTrace(messageId);
    if (!trace) throw new TraceNotFoundError();

    return toTraceDto(trace);
  }
}
