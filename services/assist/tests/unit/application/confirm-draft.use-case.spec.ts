import { beforeEach, describe, expect, it } from 'bun:test';

import { ConversationViewBuilder } from '@/application/conversation-view.builder';
import { ConfirmDraftUseCase } from '@/application/use-cases/draft/confirm-draft.use-case';
import { ConversationEntity } from '@/domain/entities/conversation.entity';
import { TicketDraftEntity } from '@/domain/entities/ticket-draft.entity';
import {
  ConversationNotFoundError,
  DraftNotPendingError,
  TicketsUnavailableError,
} from '@/domain/errors/domain.error';
import { NOW, buildTicket, createRepositories } from '@tests/unit/support/in-memory';

describe('ConfirmDraftUseCase', () => {
  let repos: ReturnType<typeof createRepositories>;
  let useCase: ConfirmDraftUseCase;

  const input = { conversationId: 'c1', draftId: 'd1', employeeId: 'emp_ana' };

  async function seedDraft(
    overrides: Partial<Parameters<typeof TicketDraftEntity.create>[0]> = {},
  ) {
    await repos.drafts.save(
      TicketDraftEntity.create(
        {
          id: 'd1',
          conversationId: 'c1',
          mode: 'CREATE',
          targetTicketId: null,
          type: 'INC',
          title: 'VPN não conecta no notebook — erro 809',
          description: 'Windows 11; reunião às 14h.',
          category: 'NETWORK_VPN',
          priority: 'HIGH',
          priorityRule: 'Alta: há um compromisso no mesmo dia',
          impact: 'SELF',
          idempotencyKey: 'draft-key-1',
          ...overrides,
        },
        NOW,
      ),
    );
  }

  beforeEach(async () => {
    repos = createRepositories();
    const view = new ConversationViewBuilder(
      repos.conversations,
      repos.messages,
      repos.drafts,
      repos.employees,
    );
    useCase = new ConfirmDraftUseCase(
      repos.conversations,
      repos.drafts,
      repos.messages,
      repos.tickets,
      repos.clock,
      view,
    );
    await repos.conversations.create(
      ConversationEntity.start({ id: 'c1', employeeId: 'emp_ana' }, NOW),
    );
  });

  it('cria o chamado, marca o rascunho e responde com o card e um trace', async () => {
    await seedDraft();

    const conversation = await useCase.execute(input);

    const created = repos.tickets.tickets[0];
    expect(created?.id).toBe('INC-20341');
    expect(repos.tickets.calls[0]).toMatchObject({ method: 'create', key: 'draft-key-1' });
    expect(conversation.drafts[0]).toMatchObject({
      status: 'CONFIRMED',
      resultTicketId: 'INC-20341',
    });

    const reply = conversation.messages.at(-1);
    expect(reply?.text).toContain('INC-20341');
    expect(reply?.blocks[0]).toMatchObject({ type: 'TICKET_CARD', ticket: { id: 'INC-20341' } });
    expect(reply?.trace?.steps[0]).toMatchObject({ tool: 'tickets.create', status: 'OK' });
    expect((await repos.conversations.findById('c1'))?.focusTicketId).toBe('INC-20341');
  });

  it('confirmar de novo não chama o sistema de chamados', async () => {
    await seedDraft();
    await useCase.execute(input);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(DraftNotPendingError);
    expect(repos.tickets.calls.filter((call) => call.method === 'create')).toHaveLength(1);
  });

  it('com o legado fora do ar, o rascunho continua pendente e pode ser reenviado', async () => {
    await seedDraft();
    repos.tickets.failWith = new TicketsUnavailableError();

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(TicketsUnavailableError);
    expect((await repos.drafts.findById('d1'))?.status).toBe('PENDING');

    repos.tickets.failWith = null;
    await useCase.execute(input);

    expect(repos.tickets.calls.map((call) => call.key)).toEqual(['draft-key-1', 'draft-key-1']);
  });

  it('registra as tentativas extras no trace', async () => {
    await seedDraft();
    repos.tickets.attemptsPerCall = 3;

    const conversation = await useCase.execute(input);

    expect(conversation.messages.at(-1)?.trace?.steps[0]).toMatchObject({
      status: 'RETRIED',
      attempts: 3,
    });
  });

  it('reabre em vez de criar quando o rascunho é de reabertura', async () => {
    repos.tickets.tickets.push(
      buildTicket({ id: 'INC-20150', status: 'RESOLVED', canReopen: true }),
    );
    await seedDraft({ mode: 'REOPEN', targetTicketId: 'INC-20150' });

    const conversation = await useCase.execute(input);

    expect(repos.tickets.calls[0]?.method).toBe('reopen');
    expect(conversation.messages.at(-1)?.text).toContain('Reabri o chamado INC-20150');
  });

  it('outro funcionário não confirma o rascunho', async () => {
    await seedDraft();

    await expect(useCase.execute({ ...input, employeeId: 'emp_bruno' })).rejects.toBeInstanceOf(
      ConversationNotFoundError,
    );
    expect(repos.tickets.calls).toHaveLength(0);
  });
});
