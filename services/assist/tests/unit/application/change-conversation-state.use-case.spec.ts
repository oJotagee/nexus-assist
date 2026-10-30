import { beforeEach, describe, expect, it } from 'bun:test';

import { ChangeConversationStateUseCase } from '@/application/use-cases/console/change-conversation-state.use-case';
import { GetConsoleConversationUseCase } from '@/application/use-cases/console/get-console-conversation.use-case';
import { ConversationViewBuilder } from '@/application/conversation-view.builder';
import { ConversationEntity } from '@/domain/entities/conversation.entity';
import { TicketConflictError, TicketsUnavailableError } from '@/domain/errors/domain.error';
import { FOLLOW_UP_OPTIONS } from '@/domain/policies/follow-up';
import { NOW, buildTicket, createRepositories } from '@tests/unit/support/in-memory';

describe('ChangeConversationStateUseCase', () => {
  let repos: ReturnType<typeof createRepositories>;
  let useCase: ChangeConversationStateUseCase;

  const run = (action: 'assume' | 'release' | 'close', extra: object = {}) =>
    useCase.execute({ conversationId: 'c1', analystId: 'emp_rafael', action, ...extra });

  beforeEach(async () => {
    repos = createRepositories();
    const view = new ConversationViewBuilder(
      repos.conversations,
      repos.messages,
      repos.drafts,
      repos.employees,
    );
    useCase = new ChangeConversationStateUseCase(
      repos.conversations,
      repos.messages,
      repos.employees,
      repos.tickets,
      repos.clock,
      new GetConsoleConversationUseCase(repos.conversations, repos.employees, view),
    );
    repos.tickets.tickets.push(buildTicket({ status: 'IN_PROGRESS' }));
    await repos.conversations.create(
      ConversationEntity.start({ id: 'c1', employeeId: 'emp_ana' }, NOW)
        .focusOn('INC-20311')
        .handOff({ reason: 'OVERDUE', summary: 'x', group: 'N2' }, NOW)
        .assume('emp_rafael', NOW),
    );
  });

  it('devolver ao agent: ele pergunta se pode fechar o chamado, com os três botões', async () => {
    const conversation = await run('release');

    const question = conversation.messages.at(-1);
    expect(question?.author).toBe('AGENT');
    expect(question?.blocks[0]).toMatchObject({
      type: 'QUICK_REPLIES',
      question: 'O atendimento do INC-20311 resolveu o seu problema?',
      options: Object.values(FOLLOW_UP_OPTIONS),
    });
  });

  it('encerrar resolvendo: fecha o chamado em nome do analista e avisa o funcionário', async () => {
    const conversation = await run('close', {
      resolveTicket: true,
      resolution: 'Perfil da VPN reinstalado.',
    });

    expect(conversation.state).toBe('CLOSED');
    expect(repos.tickets.calls.find((c) => c.method === 'close')?.args).toEqual([
      'emp_ana',
      'INC-20311',
      {
        resolution: 'RESOLVED',
        reason: 'Perfil da VPN reinstalado.',
        author: 'ANALYST',
        authorName: 'Rafael Lima',
      },
    ]);
    const notice = conversation.messages.at(-1);
    expect(notice?.text).toContain('Rafael Lima resolveu o INC-20311: Perfil da VPN reinstalado.');
    expect(notice?.blocks[0]).toMatchObject({ type: 'TICKET_CARD', ticket: { id: 'INC-20311' } });
  });

  it('encerrar sem resolver: o chamado continua aberto', async () => {
    const conversation = await run('close');

    expect(conversation.state).toBe('CLOSED');
    expect(repos.tickets.calls.some((c) => c.method === 'close')).toBe(false);
    expect(conversation.messages.at(-1)?.author).toBe('SYSTEM');
  });

  it('sistema de chamados fora do ar: nada é gravado e o analista tenta de novo', async () => {
    repos.tickets.failWith = new TicketsUnavailableError();

    await expect(run('close', { resolveTicket: true })).rejects.toBeInstanceOf(
      TicketsUnavailableError,
    );
    expect((await repos.conversations.findById('c1'))?.state).toBe('WITH_ANALYST');
  });

  it('chamado já encerrado não impede encerrar a conversa', async () => {
    repos.tickets.failWith = new TicketConflictError('O chamado INC-20311 já foi encerrado.');

    const conversation = await run('close', { resolveTicket: true });

    expect(conversation.state).toBe('CLOSED');
    expect(conversation.messages.at(-1)?.author).toBe('SYSTEM');
  });
});
