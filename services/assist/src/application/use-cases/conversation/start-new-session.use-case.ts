import type { ConversationDto } from '@nexo/shared';
import { Inject, Injectable, Optional } from '@nestjs/common';

import { ConversationViewBuilder } from '../../conversation-view.builder';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
  MESSAGE_REPOSITORY,
  type MessageRepository,
} from '../../ports/repositories.port';
import { loadOwnedConversation } from './load-owned-conversation';

export const SESSION_SUMMARIZER = Symbol('SESSION_SUMMARIZER');

/** Resume a sessão anterior para a próxima começar com contexto sem reenviar o histórico. */
export interface SessionSummarizer {
  summarize(messages: { author: string; text: string }[]): Promise<string | null>;
}

@Injectable()
export class StartNewSessionUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepository,
    private readonly view: ConversationViewBuilder,
    @Optional() @Inject(SESSION_SUMMARIZER) private readonly summarizer?: SessionSummarizer,
  ) {}

  async execute(input: { conversationId: string; employeeId: string }): Promise<ConversationDto> {
    const conversation = await loadOwnedConversation(
      this.conversations,
      input.conversationId,
      input.employeeId,
    );

    const current = await this.conversations.currentSession(conversation.id);
    const previous = await this.messages.listBySession(current.id);

    const summary = this.summarizer
      ? await this.summarizer.summarize(previous).catch(() => null)
      : null;

    await this.conversations.startSession(conversation.id, summary ?? current.summary);

    return this.view.build(conversation);
  }
}
