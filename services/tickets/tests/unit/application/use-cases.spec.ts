import { beforeEach, describe, expect, it } from 'bun:test';

import { AddTicketUpdateUseCase } from '@/application/use-cases/add-ticket-update.use-case';
import { CreateTicketUseCase } from '@/application/use-cases/create-ticket.use-case';
import { GetEmployeeTicketUseCase } from '@/application/use-cases/get-employee-ticket.use-case';
import { ListEmployeeTicketsUseCase } from '@/application/use-cases/list-employee-tickets.use-case';
import { ReopenTicketUseCase } from '@/application/use-cases/reopen-ticket.use-case';
import { TransferTicketUseCase } from '@/application/use-cases/transfer-ticket.use-case';
import { TicketNotFoundError } from '@/domain/errors/ticket.error';
import { NOW, at, buildTicket } from '@tests/unit/support/builders';
import { FixedClock, InMemoryTicketRepository } from '@tests/unit/support/in-memory';

describe('casos de uso do serviço de chamados', () => {
  let repository: InMemoryTicketRepository;
  let clock: FixedClock;

  beforeEach(() => {
    clock = new FixedClock(NOW);
    repository = new InMemoryTicketRepository().seed(
      buildTicket(),
      buildTicket({
        id: 'INC-20150',
        status: 'RESOLVED',
        resolvedAt: at('2026-10-23T10:00:00'),
        lastUpdateAt: at('2026-10-23T10:00:00'),
      }),
      buildTicket({ id: 'INC-20321', requesterId: 'emp_bruno', status: 'OPEN' }),
    );
  });

  describe('privacidade', () => {
    it('lista só os chamados do próprio funcionário', async () => {
      const tickets = await new ListEmployeeTicketsUseCase(repository, clock).execute({
        employeeId: 'emp_ana',
        scope: 'all',
      });

      expect(tickets.map((ticket) => ticket.id).sort()).toEqual(['INC-20150', 'INC-20311']);
    });

    it('chamado de outra pessoa aparece como não encontrado', async () => {
      const useCase = new GetEmployeeTicketUseCase(repository, clock);

      await expect(
        useCase.execute({ employeeId: 'emp_ana', ticketId: 'INC-20321' }),
      ).rejects.toThrow(TicketNotFoundError);
    });

    it('não permite complementar, reabrir ou transferir chamado alheio', async () => {
      const input = { employeeId: 'emp_ana', ticketId: 'INC-20321' };

      await expect(
        new AddTicketUpdateUseCase(repository, clock).execute({
          ...input,
          body: 'x',
          author: 'AGENT',
        }),
      ).rejects.toThrow(TicketNotFoundError);
      await expect(
        new ReopenTicketUseCase(repository, clock).execute({
          ...input,
          reason: 'x',
          author: 'AGENT',
        }),
      ).rejects.toThrow(TicketNotFoundError);
      await expect(
        new TransferTicketUseCase(repository, clock).execute({
          ...input,
          group: 'N1',
          summary: 'x',
        }),
      ).rejects.toThrow(TicketNotFoundError);
    });
  });

  it('aceita o id em minúsculas', async () => {
    const ticket = await new GetEmployeeTicketUseCase(repository, clock).execute({
      employeeId: 'emp_ana',
      ticketId: 'inc-20311',
    });

    expect(ticket.id).toBe('INC-20311');
  });

  it('entrega o prazo já calculado', async () => {
    const [ticket] = await new ListEmployeeTicketsUseCase(repository, clock).execute({
      employeeId: 'emp_ana',
      scope: 'open',
    });

    expect(ticket?.deadline).toEqual({
      dueAt: at('2026-10-26T10:00:00'),
      overdue: true,
      slaLabel: '3 dias úteis',
    });
    expect(ticket?.canReopen).toBe(false);
  });

  it('cria chamados com identificadores sequenciais por tipo', async () => {
    const useCase = new CreateTicketUseCase(repository, clock);
    const base = {
      employeeId: 'emp_ana',
      title: 'Licença do Figma',
      description: 'Preciso do Figma para o novo projeto.',
      category: 'SOFTWARE',
      priority: 'LOW',
      impact: 'SELF',
      author: 'AGENT',
    } as const;

    const first = await useCase.execute({ ...base, type: 'REQ' });
    const second = await useCase.execute({ ...base, type: 'REQ' });
    const incident = await useCase.execute({ ...base, type: 'INC' });

    expect([first.id, second.id, incident.id]).toEqual(['REQ-10502', 'REQ-10503', 'INC-20341']);
    expect(repository.updates.get('REQ-10502')?.[0]?.kind).toBe('CREATED');
  });

  it('reabre o INC-20150 em vez de duplicar', async () => {
    const ticket = await new ReopenTicketUseCase(repository, clock).execute({
      employeeId: 'emp_ana',
      ticketId: 'INC-20150',
      reason: 'A senha bloqueou de novo.',
      author: 'AGENT',
    });

    expect(ticket.status).toBe('OPEN');
    expect(ticket.deadline.overdue).toBe(false);
  });

  it('o detalhe inclui o histórico', async () => {
    await new TransferTicketUseCase(repository, clock).execute({
      employeeId: 'emp_ana',
      ticketId: 'INC-20311',
      group: 'N2',
      summary: 'Prazo vencido.',
    });

    const detail = await new GetEmployeeTicketUseCase(repository, clock).execute({
      employeeId: 'emp_ana',
      ticketId: 'INC-20311',
    });

    expect(detail.status).toBe('WAITING_ANALYST');
    expect(detail.updates.map((update) => update.kind)).toEqual(['TRANSFERRED']);
  });
});
