'use server';

import type { ConversationDto } from '@nexo/shared';

import type { ConversationActionResult } from './draft-actions';
import { redirectIfUnauthorized } from '@/lib/session-guard';
import { getApiErrorMessage } from '@/lib/api-error';
import { authHeaders } from '@/lib/get-access-token';
import { api } from '@/lib/api';

/** Nova sessão depois do limite de 30 mensagens; o histórico continua visível. */
export async function startNewSession(conversationId: string): Promise<ConversationActionResult> {
  const headers = await authHeaders();
  if (!headers) return { error: 'Usuário não autenticado' };

  try {
    const { data } = await api.post<ConversationDto>(
      `/conversations/${encodeURIComponent(conversationId)}/sessions`,
      {},
      { headers },
    );
    return { data };
  } catch (error) {
    redirectIfUnauthorized(error);
    return { error: getApiErrorMessage(error, 'Não foi possível iniciar uma nova sessão.') };
  }
}
