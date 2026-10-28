import { SESSION_MESSAGE_LIMIT, type MessageAuthor } from '@nexo/shared';

import type { SessionRecord } from '../entities/message';
import { SessionLimitReachedError } from '../errors/domain.error';

/** Só mensagens do funcionário e do agent contam para o limite de 30 da sessão. */
export function countsTowardSessionLimit(author: MessageAuthor): boolean {
  return author === 'EMPLOYEE' || author === 'AGENT';
}

/**
 * O funcionário só pode enviar se ainda couber a resposta do agent na sessão: uma mensagem
 * enviada na posição 30 ficaria sem resposta.
 */
export function assertCanSend(session: SessionRecord, expectsReply: boolean): void {
  const needed = expectsReply ? 2 : 1;

  if (session.messageCount + needed > SESSION_MESSAGE_LIMIT) {
    throw new SessionLimitReachedError(SESSION_MESSAGE_LIMIT);
  }
}
