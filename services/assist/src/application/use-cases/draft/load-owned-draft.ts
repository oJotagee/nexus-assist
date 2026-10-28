import type { ConversationEntity } from '@/domain/entities/conversation.entity';
import type { TicketDraftEntity } from '@/domain/entities/ticket-draft.entity';
import { DraftNotFoundError } from '@/domain/errors/domain.error';
import type { ConversationRepository, DraftRepository } from '../../ports/repositories.port';
import { loadOwnedConversation } from '../conversation/load-owned-conversation';

export async function loadOwnedDraft(
  repositories: { conversations: ConversationRepository; drafts: DraftRepository },
  input: { conversationId: string; draftId: string; employeeId: string },
): Promise<{ conversation: ConversationEntity; draft: TicketDraftEntity }> {
  const conversation = await loadOwnedConversation(
    repositories.conversations,
    input.conversationId,
    input.employeeId,
  );

  const draft = await repositories.drafts.findById(input.draftId);
  if (!draft || draft.conversationId !== conversation.id) throw new DraftNotFoundError();

  return { conversation, draft };
}
