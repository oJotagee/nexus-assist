'use server';

import type { ConversationDto, TicketCategory, TicketPriority } from '@nexo/shared';

import { api } from '@/lib/api';
import { getApiErrorCode, getApiErrorMessage } from '@/lib/api-error';
import { authHeaders } from '@/lib/get-access-token';
import { redirectIfUnauthorized } from '@/lib/session-guard';

export type ConversationActionResult = {
  data?: ConversationDto;
  error?: string;
  code?: string | null;
};

type DraftRef = { conversationId: string; draftId: string };

const draftUrl = ({ conversationId, draftId }: DraftRef) =>
  `/conversations/${encodeURIComponent(conversationId)}/drafts/${encodeURIComponent(draftId)}`;

async function call(
  request: (headers: { Authorization: string }) => Promise<{ data: ConversationDto }>,
  fallback: string,
): Promise<ConversationActionResult> {
  const headers = await authHeaders();
  if (!headers) return { error: 'Usuário não autenticado' };

  try {
    const { data } = await request(headers);
    return { data };
  } catch (error) {
    redirectIfUnauthorized(error);
    return { error: getApiErrorMessage(error, fallback), code: getApiErrorCode(error) };
  }
}

/** Único caminho que cria/atualiza chamado a partir do chat: o botão "Confirmar". */
export async function confirmDraft(ref: DraftRef): Promise<ConversationActionResult> {
  return call(
    (headers) => api.post<ConversationDto>(`${draftUrl(ref)}/confirm`, {}, { headers }),
    'Não foi possível criar o chamado. Tente novamente.',
  );
}

export async function cancelDraft(ref: DraftRef): Promise<ConversationActionResult> {
  return call(
    (headers) => api.post<ConversationDto>(`${draftUrl(ref)}/cancel`, {}, { headers }),
    'Não foi possível descartar o rascunho.',
  );
}

export type DraftChanges = {
  title?: string;
  description?: string;
  category?: TicketCategory;
  priority?: TicketPriority;
};

export async function updateDraft(
  ref: DraftRef & { changes: DraftChanges },
): Promise<ConversationActionResult> {
  return call(
    (headers) => api.patch<ConversationDto>(draftUrl(ref), ref.changes, { headers }),
    'Não foi possível salvar as alterações do rascunho.',
  );
}
