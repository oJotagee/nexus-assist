'use server';

import type { ConsoleConversationDto } from '@nexo/shared';

import { getApiErrorCode, getApiErrorMessage } from '@/lib/api-error';
import { redirectIfUnauthorized } from '@/lib/session-guard';
import { authHeaders } from '@/lib/get-access-token';
import { api } from '@/lib/api';

export type ConsoleActionResult = {
  data?: ConsoleConversationDto;
  error?: string;
  code?: string | null;
};

const MESSAGES = {
  assume: 'Não foi possível assumir o atendimento.',
  release: 'Não foi possível devolver a conversa ao agent.',
  close: 'Não foi possível encerrar o atendimento.',
} as const;

/** Assumir (agent pausa), devolver ao agent ou encerrar. */
export async function changeConversationState(input: {
  conversationId: string;
  action: keyof typeof MESSAGES;
}): Promise<ConsoleActionResult> {
  const headers = await authHeaders();
  if (!headers) return { error: 'Usuário não autenticado' };

  try {
    const { data } = await api.post<ConsoleConversationDto>(
      `/console/conversations/${encodeURIComponent(input.conversationId)}/${input.action}`,
      {},
      { headers },
    );
    return { data };
  } catch (error) {
    redirectIfUnauthorized(error);
    return {
      error: getApiErrorMessage(error, MESSAGES[input.action]),
      code: getApiErrorCode(error),
    };
  }
}

export async function sendAnalystMessage(input: {
  conversationId: string;
  text: string;
}): Promise<ConsoleActionResult> {
  const headers = await authHeaders();
  if (!headers) return { error: 'Usuário não autenticado' };

  try {
    const { data } = await api.post<ConsoleConversationDto>(
      `/console/conversations/${encodeURIComponent(input.conversationId)}/messages`,
      { text: input.text },
      { headers },
    );
    return { data };
  } catch (error) {
    redirectIfUnauthorized(error);
    return {
      error: getApiErrorMessage(error, 'Não foi possível enviar a mensagem.'),
      code: getApiErrorCode(error),
    };
  }
}
