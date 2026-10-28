import type { ThrottlerModuleOptions } from '@nestjs/throttler';

type IncomingRequest = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
};

/**
 * Chave do rate limit: o funcionário (sub do token) nas rotas autenticadas; nas outras, o IP
 * real repassado pelo frontend em X-Forwarded-For. Sem isso, todo mundo dividiria o limite do
 * servidor Next, que é quem chama o assist. O token não é validado aqui (isso é do guard de
 * auth); um token forjado só cai num balde próprio e depois recebe 401.
 */
export function rateLimitTracker(request: IncomingRequest): string {
  const authorization = request.headers.authorization;
  const token =
    typeof authorization === 'string' ? authorization.match(/^Bearer (.+)$/)?.[1] : undefined;

  if (token) {
    try {
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1] ?? '', 'base64url').toString(),
      ) as {
        sub?: unknown;
      };
      if (typeof payload.sub === 'string') return `user:${payload.sub}`;
    } catch {}
  }

  const forwarded = request.headers['x-forwarded-for'];
  const ip =
    (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) || request.ip;

  return `ip:${ip ?? 'unknown'}`;
}

const MINUTE = 60_000;

export const RATE_LIMITS = {
  /** Uso geral da API por funcionário/IP. */
  default: { ttl: MINUTE, limit: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 120) },
  /** Mensagens para o agent: cada uma custa tokens do modelo. */
  agentMessages: { ttl: MINUTE, limit: Number(process.env.RATE_LIMIT_MESSAGES_PER_MINUTE ?? 12) },
  /** Tentativas de login por IP. */
  login: { ttl: MINUTE, limit: Number(process.env.RATE_LIMIT_LOGIN_PER_MINUTE ?? 10) },
};

export const throttlerOptions: ThrottlerModuleOptions = {
  throttlers: [{ name: 'default', ...RATE_LIMITS.default }],
  getTracker: (request) => rateLimitTracker(request as IncomingRequest),
  errorMessage: 'Muitas mensagens em pouco tempo. Aguarde um instante e tente novamente.',
};
