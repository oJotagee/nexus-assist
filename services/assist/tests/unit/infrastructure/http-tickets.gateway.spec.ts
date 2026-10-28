import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';

import {
  TicketConflictError,
  TicketNotFoundError,
  TicketsUnavailableError,
} from '@/domain/errors/domain.error';
import { HttpTicketsGateway } from '@/infrastructure/http/http-tickets.gateway';

// Servidor HTTP real que imita o legado: responde 503 nas N primeiras tentativas.
describe('HttpTicketsGateway', () => {
  let server: ReturnType<typeof Bun.serve>;
  let failuresLeft = 0;
  let requests: { method: string; path: string; key: string | null; secret: string | null }[] = [];
  let nextStatus = 200;

  const ticket = {
    id: 'INC-20341',
    type: 'INC',
    title: 'VPN',
    description: 'erro 809',
    category: 'NETWORK_VPN',
    priority: 'HIGH',
    impact: 'SELF',
    status: 'OPEN',
    requesterId: 'emp_ana',
    assignedGroup: 'Suporte N1',
    assigneeName: null,
    createdAt: '2026-10-27T13:00:00.000Z',
    lastUpdateAt: '2026-10-27T13:00:00.000Z',
    resolvedAt: null,
    deadline: { dueAt: '2026-10-27T17:00:00.000Z', overdue: false, slaLabel: '4 horas úteis' },
    canReopen: false,
  };

  const gateway = () =>
    new HttpTicketsGateway({
      baseUrl: `http://localhost:${server.port}`,
      secret: 'segredo-interno',
      retryDelaysMs: [1, 1, 1],
    });

  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        requests.push({
          method: request.method,
          path: url.pathname,
          key: request.headers.get('idempotency-key'),
          secret: request.headers.get('x-internal-secret'),
        });

        if (failuresLeft > 0) {
          failuresLeft -= 1;
          return Response.json({ error: 'TicketsUnavailableError' }, { status: 503 });
        }
        if (nextStatus !== 200) {
          return Response.json(
            { message: 'O chamado INC-19802 já foi encerrado.' },
            { status: nextStatus },
          );
        }
        return Response.json(request.method === 'GET' ? [ticket] : ticket, {
          status: request.method === 'GET' ? 200 : 201,
        });
      },
    });
  });

  afterAll(() => server.stop(true));

  beforeEach(() => {
    failuresLeft = 0;
    nextStatus = 200;
    requests = [];
  });

  it('envia o segredo interno e converte as datas', async () => {
    const { data, attempts } = await gateway().list('emp_ana', 'open');

    expect(attempts).toBe(1);
    expect(data[0]?.deadline.dueAt).toBeInstanceOf(Date);
    expect(requests[0]).toMatchObject({
      path: '/internal/employees/emp_ana/tickets',
      secret: 'segredo-interno',
    });
  });

  it('repete após 503 e informa as tentativas', async () => {
    failuresLeft = 2;

    const { attempts } = await gateway().list('emp_ana', 'open');

    expect(attempts).toBe(3);
    expect(requests).toHaveLength(3);
  });

  it('repete escritas sempre com a mesma Idempotency-Key', async () => {
    failuresLeft = 1;

    await gateway().create(
      'emp_ana',
      {
        type: 'INC',
        title: 'VPN',
        description: 'erro 809',
        category: 'NETWORK_VPN',
        priority: 'HIGH',
        impact: 'SELF',
      },
      'draft-key-1',
    );

    expect(requests.map((request) => request.key)).toEqual(['draft-key-1', 'draft-key-1']);
  });

  it('desiste depois das tentativas e lança TicketsUnavailableError', async () => {
    failuresLeft = 10;

    await expect(gateway().list('emp_ana', 'open')).rejects.toBeInstanceOf(TicketsUnavailableError);
    expect(requests).toHaveLength(4);
  });

  it('traduz 404 e 409 sem repetir', async () => {
    nextStatus = 404;
    await expect(gateway().get('emp_ana', 'INC-20321')).rejects.toBeInstanceOf(TicketNotFoundError);

    nextStatus = 409;
    await expect(
      gateway().addUpdate('emp_ana', 'INC-19802', { body: 'x', author: 'AGENT' }, 'k'),
    ).rejects.toBeInstanceOf(TicketConflictError);

    expect(requests).toHaveLength(2);
  });
});
