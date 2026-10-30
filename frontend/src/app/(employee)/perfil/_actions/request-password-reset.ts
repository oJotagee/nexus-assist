'use server';

import { redirectIfUnauthorized } from '@/lib/session-guard';
import { getApiErrorMessage } from '@/lib/api-error';
import { authHeaders } from '@/lib/get-access-token';
import { api } from '@/lib/api';

export async function requestPasswordReset(): Promise<{
  data?: { sentTo: string };
  error?: string;
}> {
  const headers = await authHeaders();
  if (!headers) return { error: 'Usuário não autenticado' };

  try {
    const { data } = await api.post<{ sentTo: string }>('/me/password-reset', {}, { headers });
    return { data };
  } catch (error) {
    redirectIfUnauthorized(error);
    return { error: getApiErrorMessage(error, 'Não foi possível enviar o link de redefinição.') };
  }
}
