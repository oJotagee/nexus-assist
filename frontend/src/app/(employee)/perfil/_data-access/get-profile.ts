'use server';

import type { UserDto } from '@nexo/shared';

import { redirectIfUnauthorized } from '@/lib/session-guard';
import { getApiErrorMessage } from '@/lib/api-error';
import { authHeaders } from '@/lib/get-access-token';
import { api } from '@/lib/api';

export async function getProfile(): Promise<UserDto> {
  const headers = await authHeaders();
  if (!headers) throw new Error('Usuário não autenticado');

  try {
    const { data } = await api.get<UserDto>('/me', { headers });
    return data;
  } catch (error) {
    redirectIfUnauthorized(error);
    throw new Error(getApiErrorMessage(error, 'Não foi possível carregar seu perfil.'));
  }
}
