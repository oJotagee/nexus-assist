'use server';

import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { authHeaders } from '@/lib/get-access-token';
import { redirectIfUnauthorized } from '@/lib/session-guard';

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
