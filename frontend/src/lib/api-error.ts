import { isAxiosError } from 'axios';

const MESSAGE_BY_STATUS: Record<number, string> = {
  401: 'Sua sessão expirou. Entre novamente para continuar.',
  429: 'Muitas tentativas em pouco tempo. Aguarde um instante e tente novamente.',
};

const NETWORK_ERROR_MESSAGE =
  'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';

/** Mensagem amigável a partir do erro do axios; usa a `message` dos erros de domínio do assist. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError(error)) return fallback;
  if (!error.response) return NETWORK_ERROR_MESSAGE;

  const { status, data } = error.response;
  if (MESSAGE_BY_STATUS[status]) return MESSAGE_BY_STATUS[status];

  const body = data as { error?: unknown; message?: unknown } | undefined;
  const isDomainError = typeof body?.error === 'string' && body.error.endsWith('Error');

  if (status >= 500 && !isDomainError) return fallback;

  return isDomainError && typeof body?.message === 'string' && body.message.trim()
    ? body.message
    : fallback;
}

export function getApiErrorCode(error: unknown): string | null {
  if (!isAxiosError(error)) return null;
  const body = error.response?.data as { error?: unknown } | undefined;
  return typeof body?.error === 'string' ? body.error : null;
}
