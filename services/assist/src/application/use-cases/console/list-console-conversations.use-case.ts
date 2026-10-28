import type { ConsoleConversationListDto, ConsoleFilter } from '@nexo/shared';
import { Inject, Injectable } from '@nestjs/common';

import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
  EMPLOYEE_REPOSITORY,
  type EmployeeRepository,
  MESSAGE_REPOSITORY,
  type MessageRepository,
} from '../../ports/repositories.port';

type ListInput = { analystId: string; filter: ConsoleFilter; query?: string };

@Injectable()
export class ListConsoleConversationsUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepository,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
  ) {}

  async execute({ analystId, filter, query }: ListInput): Promise<ConsoleConversationListDto> {
    const [conversations, counts] = await Promise.all([
      this.conversations.listForConsole({ analystId, filter, query }),
      this.conversations.countForConsole(analystId),
    ]);

    const snapshots = conversations.map((conversation) => conversation.toSnapshot());
    const ids = snapshots.map((snapshot) => snapshot.id);
    const peopleIds = [
      ...new Set(
        snapshots.flatMap((snapshot) =>
          [snapshot.employeeId, snapshot.assignedAnalystId].filter((id): id is string => !!id),
        ),
      ),
    ];

    const [lastMessages, people] = await Promise.all([
      this.messages.lastByConversations(ids),
      this.employees.findManyByIds(peopleIds),
    ]);
    const personById = new Map(people.map((person) => [person.id, person]));

    return {
      counts,
      items: snapshots.map((snapshot) => {
        const employee = personById.get(snapshot.employeeId);
        const analyst = snapshot.assignedAnalystId
          ? personById.get(snapshot.assignedAnalystId)
          : undefined;
        const last = lastMessages.get(snapshot.id);

        return {
          id: snapshot.id,
          employee: {
            id: snapshot.employeeId,
            name: employee?.name ?? 'Funcionário',
            department: employee?.department ?? '',
          },
          state: snapshot.state,
          handoffReason: snapshot.handoffReason,
          handoffAt: snapshot.handoffAt?.toISOString() ?? null,
          assignedAnalyst: analyst ? { id: analyst.id, name: analyst.name } : null,
          resolvedByAgent: snapshot.resolvedByAgent,
          lastMessage: last
            ? { author: last.author, text: last.text, createdAt: last.createdAt.toISOString() }
            : null,
          focusTicketId: snapshot.focusTicketId,
        };
      }),
    };
  }
}
