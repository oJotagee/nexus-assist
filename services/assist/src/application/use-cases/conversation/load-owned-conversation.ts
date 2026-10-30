import type { ConversationEntity } from '@/domain/entities/conversation.entity';
import type { ConversationRepository } from '../../ports/repositories.port';
import { ConversationNotFoundError } from '@/domain/errors/domain.error';

/** Privacidade: conversa de outra pessoa é tratada como inexistente. */
export async function loadOwnedConversation(
  conversations: ConversationRepository,
  conversationId: string,
  employeeId: string,
): Promise<ConversationEntity> {
  const conversation = await conversations.findById(conversationId);

  if (!conversation || !conversation.isOwnedBy(employeeId)) throw new ConversationNotFoundError();

  return conversation;
}
