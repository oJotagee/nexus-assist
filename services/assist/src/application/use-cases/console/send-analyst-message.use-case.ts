import type { ConsoleConversationDto } from '@nexo/shared';
import { Inject, Injectable } from '@nestjs/common';

import { ConversationNotFoundError, EmployeeNotFoundError } from '@/domain/errors/domain.error';
import { GetConsoleConversationUseCase } from './get-console-conversation.use-case';
import { CLOCK, type Clock } from '../../ports/services.port';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
  EMPLOYEE_REPOSITORY,
  type EmployeeRepository,
  MESSAGE_REPOSITORY,
  type MessageRepository,
} from '../../ports/repositories.port';

@Injectable()
export class SendAnalystMessageUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepository,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly getConversation: GetConsoleConversationUseCase,
  ) {}

  async execute(input: {
    conversationId: string;
    analystId: string;
    text: string;
  }): Promise<ConsoleConversationDto> {
    const [conversation, analyst] = await Promise.all([
      this.conversations.findById(input.conversationId),
      this.employees.findById(input.analystId),
    ]);
    if (!conversation) throw new ConversationNotFoundError();
    if (!analyst) throw new EmployeeNotFoundError();

    conversation.assertCanAnalystReply(analyst.id);

    await this.messages.append({
      conversationId: conversation.id,
      author: 'ANALYST',
      authorId: analyst.id,
      authorName: analyst.name,
      text: input.text.trim(),
      blocks: [],
    });
    await this.conversations.save(conversation.touch(this.clock.now()));

    return this.getConversation.execute(conversation.id);
  }
}
