import { type ConversationDto, SESSION_MESSAGE_LIMIT } from '@nexo/shared';
import { Inject, Injectable } from '@nestjs/common';

import type { ConversationEntity } from '@/domain/entities/conversation.entity';
import { toDraftDto, toMessageDto } from './presenters';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
  DRAFT_REPOSITORY,
  type DraftRepository,
  EMPLOYEE_REPOSITORY,
  type EmployeeRepository,
  MESSAGE_REPOSITORY,
  type MessageRepository,
} from './ports/repositories.port';

/** Monta a visão completa da conversa (histórico de todas as sessões, rascunhos e estado). */
@Injectable()
export class ConversationViewBuilder {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepository,
    @Inject(DRAFT_REPOSITORY) private readonly drafts: DraftRepository,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
  ) {}

  async build(conversation: ConversationEntity): Promise<ConversationDto> {
    const snapshot = conversation.toSnapshot();

    const [session, messages, drafts, analyst] = await Promise.all([
      this.conversations.currentSession(snapshot.id),
      this.messages.listByConversation(snapshot.id),
      this.drafts.listByConversation(snapshot.id),
      snapshot.assignedAnalystId ? this.employees.findById(snapshot.assignedAnalystId) : null,
    ]);

    const traces = await this.messages.findTraces(
      messages.filter((message) => message.author === 'AGENT').map((message) => message.id),
    );

    return {
      id: snapshot.id,
      state: snapshot.state,
      handoffReason: snapshot.handoffReason,
      handoffSummary: snapshot.handoffSummary,
      handoffGroup: snapshot.handoffGroup,
      handoffAt: snapshot.handoffAt?.toISOString() ?? null,
      assignedAnalyst: analyst
        ? { id: analyst.id, name: analyst.name, supportLevel: analyst.supportLevel }
        : null,
      session: {
        id: session.id,
        index: session.index,
        messageCount: session.messageCount,
        limit: SESSION_MESSAGE_LIMIT,
      },
      messages: messages.map((message) => toMessageDto(message, traces.get(message.id))),
      drafts: drafts.map(toDraftDto),
    };
  }
}
