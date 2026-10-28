import type { ConversationDto } from '@nexo/shared';
import { Inject, Injectable } from '@nestjs/common';

import type { DraftEdit } from '@/domain/entities/ticket-draft.entity';
import { ConversationViewBuilder } from '../../conversation-view.builder';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
  DRAFT_REPOSITORY,
  type DraftRepository,
} from '../../ports/repositories.port';
import { CLOCK, type Clock } from '../../ports/services.port';
import { loadOwnedDraft } from './load-owned-draft';

type UpdateDraftInput = {
  conversationId: string;
  draftId: string;
  employeeId: string;
  changes: DraftEdit;
};

@Injectable()
export class UpdateDraftUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(DRAFT_REPOSITORY) private readonly drafts: DraftRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly view: ConversationViewBuilder,
  ) {}

  async execute(input: UpdateDraftInput): Promise<ConversationDto> {
    const { conversation, draft } = await loadOwnedDraft(
      { conversations: this.conversations, drafts: this.drafts },
      input,
    );

    await this.drafts.save(draft.edit(input.changes, this.clock.now()));

    return this.view.build(conversation);
  }
}
