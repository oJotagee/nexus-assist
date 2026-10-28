import { ASSIST_API_URL } from '@/lib/api';
import { getAccessToken } from '@/lib/get-access-token';

/**
 * Exceção ao padrão _actions/_data-access: server actions não fazem streaming incremental,
 * então a resposta do agent passa por este route handler, que lê o token do cookie (nunca
 * exposto ao navegador) e repassa o SSE do assist como veio.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return Response.json(
      { error: 'Unauthorized', message: 'Sua sessão expirou. Entre novamente.' },
      { status: 401 },
    );
  }

  const { id } = await params;

  let upstream: Response;
  try {
    upstream = await fetch(`${ASSIST_API_URL}/conversations/${encodeURIComponent(id)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: await request.text(),
      signal: request.signal,
    });
  } catch {
    return Response.json(
      {
        error: 'NetworkError',
        message: 'Não foi possível conectar ao assistente. Tente novamente.',
      },
      { status: 502 },
    );
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
    });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
