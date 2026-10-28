import axios, { type InternalAxiosRequestConfig } from 'axios';

// Todas as chamadas vão para o assist. O serviço de chamados fica só na rede interna.
export const ASSIST_API_URL = process.env.ASSIST_API_URL ?? 'http://localhost:8081';

export const api = axios.create({
  baseURL: ASSIST_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

const MAX_RETRIES = 2;

// Leituras repetem em falha de rede ou 5xx (o assist já repete o legado; isto cobre o próprio assist).
api.interceptors.response.use(undefined, async (error) => {
  const config = error.config as (InternalAxiosRequestConfig & { retryCount?: number }) | undefined;
  const status = error.response?.status;
  const retryable = !status || status >= 500;

  if (!config || config.method !== 'get' || !retryable || (config.retryCount ?? 0) >= MAX_RETRIES) {
    throw error;
  }

  const attempt = (config.retryCount ?? 0) + 1;
  config.retryCount = attempt;
  await new Promise((resolve) => setTimeout(resolve, 400 * attempt));

  return api.request(config);
});
