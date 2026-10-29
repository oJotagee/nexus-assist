import { beforeEach, describe, expect, it } from 'bun:test';
import { SESSION_MESSAGE_LIMIT } from '@nexo/shared';

import { ConversationViewBuilder } from '@/application/conversation-view.builder';
import type { AgentRunner, AgentTurnInput, AgentTurnResult } from '@/application/ports/agent.port';
import { SendMessageUseCase } from '@/application/use-cases/conversation/send-message.use-case';
import { ConversationEntity } from '@/domain/entities/conversation.entity';
import {
  ConversationNotFoundError,
  DailyBudgetExceededError,
  SessionLimitReachedError,
} from '@/domain/errors/domain.error';
import { NOW, buildTicket, createRepositories } from '@tests/unit/support/in-memory';

function turn(overrides: Partial<AgentTurnResult> = {}): AgentTurnResult {
  return {
    text: 'Resposta do agent.',
    blocks: [],
    steps: [
      {
        id: 's1',
        tool: 'tickets.list',
        label: 'consultou seus chamados',
        status: 'OK',
        attempts: 1,
        durationMs: 10,
      },
    ],
    decision: {
      intent: 'TICKET_STATUS',
      understood: { summary: 'Status do chamado', entities: {} },
      action: { type: 'TICKET_STATUS', label: 'mostrou o status' },
      confidence: { score: 0.9, band: 'HIGH' },
      rationale: 'Chamado identificado.',
      rulesApplied: [],
      declaredByModel: true,
    },
    handoffRequest: null,
    draft: null,
    focusTicketId: null,
    usage: { model: 'scripted', inputTokens: 1000, outputTokens: 50, latencyMs: 800 },
    ...overrides,
  };
}

class FakeRunner implements AgentRunner {
  inputs: AgentTurnInput[] = [];
  next: AgentTurnResult = turn();

  async run(input: AgentTurnInput): Promise<AgentTurnResult> {
    this.inputs.push(input);
    return this.next;
  }
}

describe('SendMessageUseCase', () => {
  let repos: ReturnType<typeof createRepositories>;
  let runner: FakeRunner;
  let useCase: SendMessageUseCase;
  const streamed: string[] = [];
  const sink = {
    message: (_message: unknown, agentWillReply: boolean) =>
      streamed.push(agentWillReply ? 'message:agent' : 'message:paused'),
    step: () => streamed.push('step'),
    textDelta: () => streamed.push('delta'),
    block: () => streamed.push('block'),
  };

  const send = (text = 'Qual o status do meu chamado?', extra: object = {}) =>
    useCase.execute({ conversationId: 'c1', employeeId: 'emp_ana', text, ...extra }, sink);

  function build(budget = 200_000) {
    useCase = new SendMessageUseCase(
      repos.conversations,
      repos.messages,
      repos.drafts,
      repos.employees,
      repos.tickets,
      runner,
      repos.clock,
      budget,
      new ConversationViewBuilder(
        repos.conversations,
        repos.messages,
        repos.drafts,
        repos.employees,
      ),
    );
  }

  beforeEach(async () => {
    repos = createRepositories();
    runner = new FakeRunner();
    streamed.length = 0;
    repos.tickets.tickets.push(buildTicket());
    await repos.conversations.create(
      ConversationEntity.start({ id: 'c1', employeeId: 'emp_ana' }, NOW),
    );
    build();
  });

  it('grava a pergunta e a resposta com o trace da decisão', async () => {
    const { message, conversation } = await send();

    expect(conversation.messages.map((m) => m.author)).toEqual(['EMPLOYEE', 'AGENT']);
    expect(message?.trace).toMatchObject({ intent: 'TICKET_STATUS', confidence: { band: 'HIGH' } });
    expect(conversation.session.messageCount).toBe(2);
    expect(streamed[0]).toBe('message:agent');
    expect((await repos.conversations.findById('c1'))?.toSnapshot().resolvedByAgent).toBe(true);
  });

  it('com a conversa esperando um analista, o agent não é chamado', async () => {
    const current = await repos.conversations.findById('c1');
    if (!current) throw new Error('conversa não encontrada');
    await repos.conversations.save(
      current.handOff({ reason: 'OVERDUE', summary: 'x', group: 'N2' }, NOW),
    );

    const { message, conversation } = await send('Alguém aí?');

    expect(runner.inputs).toHaveLength(0);
    expect(streamed[0]).toBe('message:paused');
    expect(message).toBeNull();
    expect(conversation.state).toBe('WAITING_ANALYST');
    expect(conversation.messages.map((m) => m.author)).toEqual(['EMPLOYEE']);
  });

  it('pedido de analista transfere, marca o chamado no legado e pausa o agent', async () => {
    runner.next = turn({
      focusTicketId: 'INC-20311',
      handoffRequest: {
        reason: 'OVERDUE',
        summary: 'INC-20311 vencido há 6 dias; pediu analista.',
      },
    });

    const { conversation, message } = await send('Quero falar com um analista.');

    expect(conversation.state).toBe('WAITING_ANALYST');
    expect(conversation.handoffGroup).toBe('N2');
    expect(conversation.handoffSummary).toContain('INC-20311 vencido');
    expect(repos.tickets.calls.find((c) => c.method === 'transfer')?.args[1]).toBe('INC-20311');
    expect(message?.trace?.intent).toBe('HANDOFF');
    expect(message?.blocks.at(-1)).toMatchObject({ type: 'NOTICE' });
    expect(conversation.messages.at(-1)).toMatchObject({ author: 'SYSTEM' });
  });

  it('baixa segurança numa ação força a transferência por política, com aviso no texto', async () => {
    runner.next = turn({
      decision: {
        ...turn().decision,
        intent: 'TICKET_UPDATE',
        confidence: { score: 0.4, band: 'LOW' },
      },
    });

    const { conversation, message } = await send('faz aquilo lá no outro');

    expect(conversation.state).toBe('WAITING_ANALYST');
    expect(conversation.handoffReason).toBe('LOW_CONFIDENCE');
    expect(message?.text).toContain('Encaminhei esta conversa para o Suporte N1');
  });

  it('rascunho crítico transfere para o N2 e o rascunho continua disponível', async () => {
    runner.next = turn({
      decision: { ...turn().decision, intent: 'TICKET_CREATE' },
      draft: {
        id: 'd1',
        mode: 'CREATE',
        targetTicketId: null,
        type: 'INC',
        title: 'E-mail fora do ar para a empresa',
        description: 'Ninguém recebe e-mail desde 9h.',
        category: 'EMAIL',
        priority: 'CRITICAL',
        priorityRule: 'Crítica: algo parado para uma equipe ou para a empresa',
        impact: 'COMPANY',
        dueAt: NOW.toISOString(),
        status: 'PENDING',
        resultTicketId: null,
      },
    });

    const { conversation } = await send('A empresa toda está sem e-mail!');

    expect(conversation.handoffReason).toBe('CRITICAL');
    expect(conversation.handoffGroup).toBe('N2');
  });

  it('marca a opção escolhida na mensagem anterior do agent', async () => {
    runner.next = turn({
      blocks: [
        {
          type: 'QUICK_REPLIES',
          question: 'Quem é afetado?',
          options: ['Só eu', 'Minha equipe'],
          answered: null,
        },
      ],
    });
    const first = await send('VPN não conecta');

    runner.next = turn();
    const second = await send('Só eu', {
      reply: { messageId: first.message?.id, kind: 'QUICK_REPLY', value: 'Só eu' },
    });

    const agentMessage = second.conversation.messages.find((m) => m.id === first.message?.id);
    expect(agentMessage?.blocks[0]).toMatchObject({ answered: 'Só eu' });
  });

  it('envia ao agent o histórico da sessão e o chamado em foco', async () => {
    runner.next = turn({ focusTicketId: 'INC-20311' });
    await send('Status do INC-20311');
    await send('E agora?');

    expect(runner.inputs[1]?.history.map((m) => m.author)).toEqual(['EMPLOYEE', 'AGENT']);
    expect(runner.inputs[1]?.focusTicketId).toBe('INC-20311');
  });

  it('conversa encerrada pelo analista: a mensagem nova reabre com o agent e ele responde', async () => {
    const closed = (await repos.conversations.findById('c1'))
      ?.assume('emp_rafael', NOW)
      .close('emp_rafael', NOW);
    if (!closed) throw new Error('conversa não encontrada');
    await repos.conversations.save(closed);

    const { message, conversation } = await send('Agora preciso de outra coisa: o mouse parou.');

    expect(streamed[0]).toBe('message:agent');
    expect(runner.inputs).toHaveLength(1);
    expect(message?.author).toBe('AGENT');
    expect(conversation.state).toBe('AGENT');
  });

  it('recusa quando a sessão chegou ao limite', async () => {
    (await repos.conversations.currentSession('c1')).messageCount = SESSION_MESSAGE_LIMIT - 1;

    await expect(send()).rejects.toBeInstanceOf(SessionLimitReachedError);
    expect(runner.inputs).toHaveLength(0);
  });

  it('recusa quando o orçamento diário de tokens acabou', async () => {
    build(1000);
    await send();

    await expect(send()).rejects.toBeInstanceOf(DailyBudgetExceededError);
  });

  it('outro funcionário não escreve na conversa', async () => {
    await expect(
      useCase.execute({ conversationId: 'c1', employeeId: 'emp_bruno', text: 'oi' }, sink),
    ).rejects.toBeInstanceOf(ConversationNotFoundError);
  });
});
