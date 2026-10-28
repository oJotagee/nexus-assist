import axios, { type InternalAxiosRequestConfig } from 'axios';
import { headers } from 'next/headers';

export const ASSIST_API_URL = process.env.ASSIST_API_URL ?? 'http://localhost:8081';

export const api = axios.create({
  baseURL: ASSIST_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const clientIp = await getClientIp();
  if (clientIp) config.headers.set('X-Forwarded-For', clientIp);
  return config;
});

async function getClientIp(): Promise<string | null> {
  try {
    const incoming = await headers();
    const forwarded = incoming.get('x-forwarded-for')?.split(',')[0]?.trim();
    return forwarded || incoming.get('x-real-ip') || null;
  } catch {
    return null;
  }
}

const MAX_RETRIES = 2;

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
