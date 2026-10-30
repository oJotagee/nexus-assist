import type { ConversationDto } from '@nexo/shared';
import { Inject, Injectable } from '@nestjs/common';

import { ConversationViewBuilder } from '../../conversation-view.builder';
import { loadOwnedDraft } from './load-owned-draft';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
  DRAFT_REPOSITORY,
  type DraftRepository,
  MESSAGE_REPOSITORY,
  type MessageRepository,
} from '../../ports/repositories.port';

@Injectable()
export class CancelDraftUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(DRAFT_REPOSITORY) private readonly drafts: DraftRepository,
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepository,
    private readonly view: ConversationViewBuilder,
  ) {}

  async execute(input: {
    conversationId: string;
    draftId: string;
    employeeId: string;
  }): Promise<ConversationDto> {
    const { conversation, draft } = await loadOwnedDraft(
      { conversations: this.conversations, drafts: this.drafts },
      input,
    );

    await this.drafts.save(draft.cancel());
    await this.messages.append({
      conversationId: conversation.id,
      author: 'SYSTEM',
      authorId: null,
      authorName: null,
      text: 'Rascunho descartado. Nenhum chamado foi criado.',
      blocks: [],
    });

    return this.view.build(conversation);
  }
}
