/**
 * Smoke test ponta a ponta contra o app rodando (frontend :3000 + assist + tickets):
 *   bun frontend/tests/smoke/e2e-smoke.ts [baseUrl]
 * Faz o fluxo do navegador: CSRF do Auth.js, login, páginas protegidas e o proxy SSE.
 */
const BASE = process.argv[2] ?? 'http://localhost:3000';
const jar = new Map<string, string>();

function storeCookies(response: Response) {
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(';');
    const [name, ...value] = (pair ?? '').split('=');
    if (name) jar.set(name.trim(), value.join('='));
  }
}

const cookieHeader = () => [...jar].map(([name, value]) => `${name}=${value}`).join('; ');

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE}${path}`, {
    redirect: 'manual',
    ...init,
    headers: { ...(init.headers as Record<string, string>), cookie: cookieHeader() },
  });
  storeCookies(response);
  return response;
}

function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) process.exitCode = 1;
}

async function login(email: string) {
  jar.clear();
  const csrf = (await (await request('/api/auth/csrf')).json()) as { csrfToken: string };
  const response = await request('/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email,
      password: 'qualquer',
      json: 'true',
    }),
  });
  return response;
}

const unauthenticated = await request('/atendimento');
check(
  'sem sessão, /atendimento redireciona para /login',
  unauthenticated.headers.get('location')?.includes('/login') ?? false,
);

const loginPage = await request('/login');
const loginHtml = await loginPage.text();
check(
  'tela de login renderiza',
  loginPage.status === 200 && loginHtml.includes('Seu problema de TI'),
);

const wrong = await login('naoexiste@nexo.com.br');
check(
  'e-mail desconhecido não cria sessão',
  ![...jar.keys()].some((name) => name.includes('session-token')),
  `status ${wrong.status}`,
);

await login('fabio.nunes@nexo.com.br');
check(
  'login do funcionário cria sessão',
  [...jar.keys()].some((name) => name.includes('session-token')),
);

const home = await request('/login');
check(
  'logado, /login leva ao atendimento',
  home.headers.get('location')?.endsWith('/atendimento') ?? false,
);

const chat = await request('/atendimento');
const chatHtml = await chat.text();
check(
  'atendimento renderiza com o histórico',
  chat.status === 200 &&
    chatHtml.includes('senha da rede') &&
    chatHtml.includes('mensagens nesta sessão'),
);
check('accessToken não vai para o HTML', !chatHtml.includes('eyJhbGciOiJIUzI1NiIs'));

const consoleArea = await request('/console');
check(
  'funcionário não entra no console',
  consoleArea.headers.get('location')?.endsWith('/atendimento') ?? false,
);

const profile = await request('/perfil');
const profileHtml = await profile.text();
check(
  'perfil renderiza dados do funcionário',
  profile.status === 200 && profileHtml.includes('fabio.nunes@nexo.com.br'),
);

// O id vem no payload do RSC, com aspas escapadas (\"id\":\"...\").
const conversationId = chatHtml.match(/\\?"id\\?":\\?"([a-z0-9-]{20,})\\?",\\?"state/)?.[1];
check('id da conversa disponível na página', !!conversationId, conversationId ?? 'não encontrado');

if (conversationId) {
  const stream = await request(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Teste de smoke: minha VPN dá erro 809' }),
  });
  const body = await stream.text();
  const events = body
    .split('\n\n')
    .filter(Boolean)
    .map(
      (chunk) => JSON.parse(chunk.replace(/^data: /, '')) as { type: string; message?: unknown },
    );
  check(
    'proxy SSE responde text/event-stream',
    stream.headers.get('content-type')?.includes('text/event-stream') ?? false,
  );
  check('mensagem do funcionário volta no stream', events[0]?.type === 'message');
  check(
    'stream termina com done ou error claro',
    ['done', 'error'].includes(events.at(-1)?.type ?? ''),
    JSON.stringify(events.at(-1)).slice(0, 140),
  );

  const empty = await request(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '' }),
  });
  check('mensagem vazia é recusada antes do stream', empty.status === 400);
}

const anonymousStream = await fetch(`${BASE}/api/conversations/x/messages`, {
  method: 'POST',
  body: '{}',
});
check('proxy SSE exige sessão', anonymousStream.status === 401);

await login('rafael.lima@nexo.com.br');
const analystHome = await request('/atendimento');
check(
  'analista é levado ao console',
  analystHome.headers.get('location')?.endsWith('/console') ?? false,
);

export {};
