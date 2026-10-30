'use server';

import type { DecisionTraceDto } from '@nexo/shared';

import { redirectIfUnauthorized } from '@/lib/session-guard';
import { getApiErrorMessage } from '@/lib/api-error';
import { authHeaders } from '@/lib/get-access-token';
import { api } from '@/lib/api';

/** Detalhe da decisão do agent (usado no chat e no console). */
export async function getDecisionTrace(messageId: string): Promise<DecisionTraceDto> {
  const headers = await authHeaders();
  if (!headers) throw new Error('Usuário não autenticado');

  try {
    const { data } = await api.get<DecisionTraceDto>(`/traces/${encodeURIComponent(messageId)}`, {
      headers,
    });
    return data;
  } catch (error) {
    redirectIfUnauthorized(error);
    throw new Error(getApiErrorMessage(error, 'Não foi possível carregar o detalhe da decisão.'));
  }
}
