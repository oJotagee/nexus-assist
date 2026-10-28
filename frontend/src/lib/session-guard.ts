import { isAxiosError } from 'axios';
import { redirect } from 'next/navigation';

/**
 * Token do assist expirado (ou revogado) → volta para o login, em vez de mostrar erro genérico.
 * Funciona em data-access (RSC) e em server actions; deve ser chamado dentro do catch.
 */
export function redirectIfUnauthorized(error: unknown): void {
  if (isAxiosError(error) && error.response?.status === 401) redirect('/login');
}
