import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { config } from 'dotenv';

config({ path: `${import.meta.dir}/../../.env` });

import 'reflect-metadata';
import type { AgentStreamEvent, ConsoleConversationDto, ConversationDto } from '@nexo/shared';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import { AGENT_MODEL } from '@/infrastructure/agent/model';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { type ScriptedStep, scriptedModel } from '@tests/unit/support/scripted-model';

/**
 * Fluxo completo pelo HTTP: assist real + Postgres real + serviço de chamados real (subprocesso,
 * com 10% de falhas simuladas). Só o modelo é roteirizado, para o teste ser determinístico.
 */
const TICKETS_PORT = 18082;
const TICKETS_DIR = `${import.meta.dir}/../../../tickets`;
const SECRET = process.env.INTERNAL_API_SECRET ?? '';

const EMPLOYEE = { id: `emp_it_${crypto.randomUUID().slice(0, 8)}`, name: 'Teste Integração' };
const EMAIL = `${EMPLOYEE.id}@nexo.com.br`;

const SCRIPT: ScriptedStep[] = [
  {
    tools: [
      {
        name: 'draft_ticket',
        input: {
          type: 'INC',
          title: 'VPN não conecta no notebook — erro 809',
          description: 'Desde ontem, Windows 11. Reunião com cliente às 14h.',
          category: 'NETWORK_VPN',
          impact: 'SELF',
          blocksWork: true,
          sameDayCommitment: true,
        },
      },
      {
        name: 'register_decision',
        input: {
          intent: 'TICKET_CREATE',
          understoodSummary: 'VPN com erro 809 no Windows 11, reunião às 14h',
          entities: { erro: '809', sistema: 'Windows 11' },
          actionLabel: 'montou o rascunho',
          confidence: 0.9,
          rationale: 'O artigo do erro 809 vale só para Windows 10; precisa de chamado.',
          rulesApplied: ['Prioridade Alta: compromisso no mesmo dia'],
        },
      },
    ],
  },
  { text: 'Preparei o chamado com prioridade alta por causa da reunião. Confira e confirme.' },
  {
    tools: [
      {
        name: 'request_handoff',
        input: {
          reason: 'USER_REQUESTED',
          summary: 'Funcionário com VPN erro 809 (Windows 11) pediu para falar com um analista.',
        },
      },
    ],
  },
  { text: 'Chamei um analista; ele continua por aqui.' },
];

describe('Fluxo da conversa (integration)', () => {
  let tickets: ReturnType<typeof Bun.spawn>;
  let app: INestApplication;
  let prisma: PrismaService;
  let base: string;
  let employeeToken: string;
  let analystToken: string;
  let conversationId: string;
  const script = scriptedModel(SCRIPT);

  const json = (token: string) => ({
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
  });

  async function login(email: string): Promise<string> {
    const response = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'qualquer' }),
    });
    return ((await response.json()) as { accessToken: string }).accessToken;
  }

  async function sendMessage(text: string): Promise<AgentStreamEvent[]> {
    const response = await fetch(`${base}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: json(employeeToken),
      body: JSON.stringify({ text }),
    });
    const body = await response.text();
    return body
      .split('\n\n')
      .filter(Boolean)
      .map((chunk) => JSON.parse(chunk.replace(/^data: /, '')) as AgentStreamEvent);
  }

  const done = (events: AgentStreamEvent[]) => {
    const last = events.at(-1);
    if (last?.type !== 'done') throw new Error(`stream terminou com ${JSON.stringify(last)}`);
    return last.conversation;
  };

  async function waitForTickets(): Promise<void> {
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        if ((await fetch(`http://localhost:${TICKETS_PORT}/health`)).ok) return;
      } catch {}
      await Bun.sleep(200);
    }
    throw new Error('serviço de chamados não subiu');
  }

  beforeAll(async () => {
    const ticketsEnv = config({ path: `${TICKETS_DIR}/.env`, processEnv: {} }).parsed ?? {};
    tickets = Bun.spawn(['bun', 'src/main.ts'], {
      cwd: TICKETS_DIR,
      env: {
        ...process.env,
        ...ticketsEnv,
        PORT: String(TICKETS_PORT),
        TICKETS_FAILURE_RATE: '0.1',
        TICKETS_MAX_LATENCY_MS: '50',
      },
      stdout: 'ignore',
      stderr: 'ignore',
    });
    await waitForTickets();
    process.env.TICKETS_API_URL = `http://localhost:${TICKETS_PORT}`;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AGENT_MODEL)
      .useValue(script.model)
      .compile();

    app = configureApp(moduleRef.createNestApplication({ logger: false }));
    await app.listen(0);
    base = await app.getUrl();
    prisma = app.get(PrismaService);

    await prisma.employee.create({
      data: {
        ...EMPLOYEE,
        email: EMAIL,
        department: 'QA',
        role: 'EMPLOYEE',
        passwordChangedAt: new Date(),
      },
    });
    employeeToken = await login(EMAIL);
    analystToken = await login('rafael.lima@nexo.com.br');
  });

  afterAll(async () => {
    await prisma.conversation.deleteMany({ where: { employeeId: EMPLOYEE.id } });
    await prisma.employee.delete({ where: { id: EMPLOYEE.id } });
    await app.close();
    tickets.kill();
  });

  it('abre a conversa vazia na primeira visita', async () => {
    const response = await fetch(`${base}/conversations/active`, { headers: json(employeeToken) });
    const conversation = (await response.json()) as ConversationDto;

    conversationId = conversation.id;
    expect(conversation.state).toBe('AGENT');
    expect(conversation.messages).toEqual([]);
  });

  it('o agent monta o rascunho em streaming, com passos e trace', async () => {
    const events = await sendMessage('Minha VPN dá erro 809, é Windows 11 e tenho reunião às 14h.');
    const conversation = done(events);

    expect(events[0]?.type).toBe('message');
    expect(events.filter((event) => event.type === 'step').length).toBeGreaterThan(3);
    expect(events.some((event) => event.type === 'text-delta')).toBe(true);

    const reply = conversation.messages.at(-1);
    expect(reply?.trace).toMatchObject({ intent: 'TICKET_CREATE', confidence: { band: 'HIGH' } });
    expect(conversation.drafts[0]).toMatchObject({
      status: 'PENDING',
      priority: 'HIGH',
      category: 'NETWORK_VPN',
    });

    const legacy = await fetch(
      `http://localhost:${TICKETS_PORT}/internal/employees/${EMPLOYEE.id}/tickets?scope=all`,
      {
        headers: { 'x-internal-secret': SECRET },
      },
    );
    if (legacy.ok) expect(await legacy.json()).toEqual([]);
  });

  it('confirmar grava no sistema de chamados uma única vez, mesmo clicando duas vezes', async () => {
    const draftId = (
      (await (
        await fetch(`${base}/conversations/active`, { headers: json(employeeToken) })
      ).json()) as ConversationDto
    ).drafts[0]?.id;
    const url = `${base}/conversations/${conversationId}/drafts/${draftId}/confirm`;

    const [first, second] = await Promise.all([
      fetch(url, { method: 'POST', headers: json(employeeToken) }),
      fetch(url, { method: 'POST', headers: json(employeeToken) }),
    ]);
    const statuses = [first.status, second.status].sort();

    expect(statuses[0]).toBe(200);

    const trace = await prisma.decisionTrace.findFirst({
      where: { message: { conversationId }, action: { path: ['type'], equals: 'CONFIRM_CREATE' } },
    });
    expect(trace).not.toBeNull();

    const count = async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const response = await fetch(
          `http://localhost:${TICKETS_PORT}/internal/employees/${EMPLOYEE.id}/tickets?scope=all`,
          {
            headers: { 'x-internal-secret': SECRET },
          },
        );
        if (response.ok) return ((await response.json()) as unknown[]).length;
      }
      throw new Error('legado indisponível');
    };
    expect(await count()).toBe(1);
  });

  it('pedido de analista transfere e aparece no console com o resumo', async () => {
    const conversation = done(await sendMessage('Quero falar com um analista.'));

    expect(conversation.state).toBe('WAITING_ANALYST');
    expect(conversation.handoffReason).toBe('USER_REQUESTED');

    const list = await fetch(`${base}/console/conversations?filter=waiting`, {
      headers: json(analystToken),
    });
    const item = (
      (await list.json()) as { items: { id: string; handoffReason: string }[] }
    ).items.find((entry) => entry.id === conversationId);
    expect(item?.handoffReason).toBe('USER_REQUESTED');
  });

  it('com a conversa na fila ou com analista, o agent não responde', async () => {
    const callsBefore = script.calls();

    const events = await sendMessage('Alguém aí?');
    expect(done(events).messages.at(-1)?.author).toBe('EMPLOYEE');

    const assumed = await fetch(`${base}/console/conversations/${conversationId}/assume`, {
      method: 'POST',
      headers: json(analystToken),
    });
    expect(((await assumed.json()) as ConsoleConversationDto).state).toBe('WITH_ANALYST');

    const events2 = await sendMessage('Obrigado por assumir.');
    expect(done(events2).messages.at(-1)?.author).toBe('EMPLOYEE');
    expect(script.calls()).toBe(callsBefore);
  });

  it('o analista responde, devolve ao agent e encerra', async () => {
    const reply = await fetch(`${base}/console/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: json(analystToken),
      body: JSON.stringify({ text: 'Oi! Vou reinstalar o cliente de VPN remotamente.' }),
    });
    expect(((await reply.json()) as ConsoleConversationDto).messages.at(-1)?.author).toBe(
      'ANALYST',
    );

    const released = await fetch(`${base}/console/conversations/${conversationId}/release`, {
      method: 'POST',
      headers: json(analystToken),
    });
    expect(((await released.json()) as ConsoleConversationDto).state).toBe('AGENT');

    await fetch(`${base}/console/conversations/${conversationId}/assume`, {
      method: 'POST',
      headers: json(analystToken),
    });
    const closed = await fetch(`${base}/console/conversations/${conversationId}/close`, {
      method: 'POST',
      headers: json(analystToken),
    });
    expect(((await closed.json()) as ConsoleConversationDto).state).toBe('CLOSED');
  });

  it('funcionário não acessa o console nem a conversa de outra pessoa', async () => {
    const consoleResponse = await fetch(`${base}/console/conversations`, {
      headers: json(employeeToken),
    });
    expect(consoleResponse.status).toBe(403);

    const anaToken = await login('ana.souza@nexo.com.br');
    const intrusion = await fetch(`${base}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: json(anaToken),
      body: JSON.stringify({ text: 'oi' }),
    });
    const events = (await intrusion.text()).trim();
    expect(events).toContain('ConversationNotFoundError');
  });
});
