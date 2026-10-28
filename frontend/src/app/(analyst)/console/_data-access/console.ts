'use server';

import type {
  ConsoleConversationDto,
  ConsoleConversationListDto,
  ConsoleFilter,
  TicketSummaryDto,
} from '@nexo/shared';

import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { authHeaders } from '@/lib/get-access-token';
import { redirectIfUnauthorized } from '@/lib/session-guard';

async function get<T>(url: string, fallback: string, params?: Record<string, string>): Promise<T> {
  const headers = await authHeaders();
  if (!headers) throw new Error('Usuário não autenticado');

  try {
    const { data } = await api.get<T>(url, { headers, params });
    return data;
  } catch (error) {
    redirectIfUnauthorized(error);
    throw new Error(getApiErrorMessage(error, fallback));
  }
}

export async function listConsoleConversations(input: {
  filter: ConsoleFilter;
  query?: string;
}): Promise<ConsoleConversationListDto> {
  return get('/console/conversations', 'Não foi possível carregar as conversas.', {
    filter: input.filter,
    ...(input.query?.trim() ? { q: input.query.trim() } : {}),
  });
}

export async function getConsoleConversation(id: string): Promise<ConsoleConversationDto> {
  return get(
    `/console/conversations/${encodeURIComponent(id)}`,
    'Não foi possível carregar a conversa.',
  );
}

/** Chamados do funcionário da conversa (painel "Chamados da Ana"). */
export async function getEmployeeTickets(conversationId: string): Promise<TicketSummaryDto[]> {
  return get(
    `/console/conversations/${encodeURIComponent(conversationId)}/tickets`,
    'Não foi possível carregar os chamados do funcionário.',
  );
}
