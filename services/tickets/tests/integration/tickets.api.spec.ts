import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { config } from 'dotenv';

config({ path: `${import.meta.dir}/../../.env` });
// Os testes validam o comportamento; a instabilidade tem teste unitário próprio.
process.env.TICKETS_FAILURE_RATE = '0';
process.env.TICKETS_MAX_LATENCY_MS = '0';

import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';

describe('Tickets API (integration)', () => {
  // Funcionários exclusivos do teste, para não tocar nos dados do seed.
  const owner = `emp_it_${crypto.randomUUID().slice(0, 8)}`;
  const stranger = `emp_it_${crypto.randomUUID().slice(0, 8)}`;
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;

  const headers = (extra: Record<string, string> = {}) => ({
    'content-type': 'application/json',
    'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
    ...extra,
  });

  const newTicket = {
    type: 'INC',
    title: 'VPN não conecta no notebook — erro 809',
    description: 'Windows 11; reunião com cliente às 14h.',
    category: 'NETWORK_VPN',
    priority: 'HIGH',
    impact: 'SELF',
  };

  const create = (employeeId: string, key: string, body: object = newTicket) =>
    fetch(`${baseUrl}/internal/employees/${employeeId}/tickets`, {
      method: 'POST',
      headers: headers({ 'idempotency-key': key }),
      body: JSON.stringify(body),
    });

  beforeAll(async () => {
    app = configureApp(await NestFactory.create(AppModule, { logger: false }));
    await app.listen(0);
    baseUrl = await app.getUrl();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    const tickets = await prisma.ticket.findMany({
      where: { requesterId: { in: [owner, stranger] } },
      select: { id: true },
    });
    await prisma.ticket.deleteMany({ where: { id: { in: tickets.map(({ id }) => id) } } });
    await prisma.idempotencyRecord.deleteMany({ where: { key: { startsWith: owner } } });
    await app.close();
  });

  it('cria o chamado e a repetição com a mesma chave não duplica', async () => {
    const key = `${owner}-create`;

    const first = await create(owner, key);
    const created = await first.json();
    const retry = await create(owner, key);
    const replayed = await retry.json();

    expect(first.status).toBe(201);
    expect(created.id).toMatch(/^INC-\d+$/);
    expect(created.deadline.dueAt).not.toBeNull();
    expect(retry.headers.get('idempotent-replayed')).toBe('true');
    expect(replayed.id).toBe(created.id);
    expect(await prisma.ticket.count({ where: { requesterId: owner } })).toBe(1);
  });

  it('a mesma chave enviada duas vezes ao mesmo tempo cria um chamado só (duplo clique)', async () => {
    const before = await prisma.ticket.count({ where: { requesterId: owner } });
    const key = `${owner}-double-click`;

    const responses = await Promise.all([
      create(owner, key),
      create(owner, key),
      create(owner, key),
    ]);
    const ids = await Promise.all(responses.map(async (response) => (await response.json()).id));

    expect(new Set(ids).size).toBe(1);
    expect(await prisma.ticket.count({ where: { requesterId: owner } })).toBe(before + 1);
  });

  it('criações simultâneas recebem identificadores distintos', async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, index) => create(owner, `${owner}-parallel-${index}`)),
    );
    const ids = await Promise.all(responses.map(async (response) => (await response.json()).id));

    expect(new Set(ids).size).toBe(5);
  });

  it('outro funcionário não vê nem altera o chamado', async () => {
    const created = await (await create(owner, `${owner}-private`)).json();

    const list = await fetch(`${baseUrl}/internal/employees/${stranger}/tickets?scope=all`, {
      headers: headers(),
    });
    const detail = await fetch(`${baseUrl}/internal/employees/${stranger}/tickets/${created.id}`, {
      headers: headers(),
    });
    const update = await fetch(
      `${baseUrl}/internal/employees/${stranger}/tickets/${created.id}/updates`,
      {
        method: 'POST',
        headers: headers({ 'idempotency-key': `${owner}-intruder` }),
        body: JSON.stringify({ body: 'tentativa' }),
      },
    );

    expect(await list.json()).toEqual([]);
    expect(detail.status).toBe(404);
    expect(update.status).toBe(404);
  });

  it('complementa e transfere, registrando tudo no histórico', async () => {
    const created = await (await create(owner, `${owner}-history`)).json();
    const ticketUrl = `${baseUrl}/internal/employees/${owner}/tickets/${created.id}`;

    await fetch(`${ticketUrl}/updates`, {
      method: 'POST',
      headers: headers({ 'idempotency-key': `${owner}-history-update` }),
      body: JSON.stringify({ body: 'Reinstalei o cliente de VPN e o erro continua.' }),
    });
    const transfer = await fetch(`${ticketUrl}/transfer`, {
      method: 'POST',
      headers: headers({ 'idempotency-key': `${owner}-history-transfer` }),
      body: JSON.stringify({ group: 'N2', summary: 'Reunião às 14h em risco.' }),
    });
    const detail = await (await fetch(ticketUrl, { headers: headers() })).json();

    expect(transfer.status).toBe(201);
    expect(detail.status).toBe('WAITING_ANALYST');
    expect(detail.assignedGroup).toBe('Suporte N2');
    expect(detail.updates.map((update: { kind: string }) => update.kind)).toEqual([
      'CREATED',
      'COMMENT',
      'TRANSFERRED',
    ]);
  });

  it('valida o corpo e exige o segredo interno', async () => {
    const invalid = await create(owner, `${owner}-invalid`, { ...newTicket, category: 'RH' });
    const noSecret = await fetch(`${baseUrl}/internal/employees/${owner}/tickets`);

    expect(invalid.status).toBe(400);
    expect(noSecret.status).toBe(401);
  });
});
