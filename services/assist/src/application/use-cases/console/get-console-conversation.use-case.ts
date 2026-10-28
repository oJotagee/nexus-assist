import type { ConsoleConversationDto } from '@nexo/shared';
import { Inject, Injectable } from '@nestjs/common';

import { ConversationNotFoundError } from '@/domain/errors/domain.error';
import { ConversationViewBuilder } from '../../conversation-view.builder';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
  EMPLOYEE_REPOSITORY,
  type EmployeeRepository,
} from '../../ports/repositories.port';

@Injectable()
export class GetConsoleConversationUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    private readonly view: ConversationViewBuilder,
  ) {}

  async execute(conversationId: string): Promise<ConsoleConversationDto> {
    const conversation = await this.conversations.findById(conversationId);
    if (!conversation) throw new ConversationNotFoundError();

    const [base, employee] = await Promise.all([
      this.view.build(conversation),
      this.employees.findById(conversation.employeeId),
    ]);

    return {
      ...base,
      focusTicketId: conversation.focusTicketId,
      employee: {
        id: conversation.employeeId,
        name: employee?.name ?? 'Funcionário',
        email: employee?.email ?? '',
        department: employee?.department ?? '',
      },
    };
  }
}
