'use server';

import type { ConversationDto } from '@nexo/shared';

import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { authHeaders } from '@/lib/get-access-token';

/** Conversa atual do funcionário, com todo o histórico ("continuar de onde parei"). */
export async function getActiveConversation(): Promise<ConversationDto> {
  const headers = await authHeaders();
  if (!headers) throw new Error('Usuário não autenticado');

  try {
    const { data } = await api.get<ConversationDto>('/conversations/active', { headers });
    return data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Não foi possível carregar sua conversa.'));
  }
}
