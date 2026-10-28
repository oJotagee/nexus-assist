import { beforeEach, describe, expect, it } from 'bun:test';
import type { MessageBlock, TraceStep } from '@nexo/shared';

import type { AgentTurnInput } from '@/application/ports/agent.port';
import { AgentUnavailableError } from '@/application/ports/agent.port';
import { ConversationEntity } from '@/domain/entities/conversation.entity';
import { NexoAgentRunner } from '@/infrastructure/agent/nexo-agent.runner';
import { NOW, at, buildTicket, createRepositories } from '@tests/unit/support/in-memory';
import { scriptedModel } from '@tests/unit/support/scripted-model';

describe('NexoAgentRunner (Mastra com modelo roteirizado)', () => {
  let repos: ReturnType<typeof createRepositories>;
  let events: { steps: TraceStep[]; text: string; blocks: MessageBlock[] };

  const sink = {
    step: (step: TraceStep) => events.steps.push(step),
    textDelta: (delta: string) => {
      events.text += delta;
    },
    block: (block: MessageBlock) => events.blocks.push(block),
  };

  const input = (overrides: Partial<AgentTurnInput> = {}): AgentTurnInput => ({
    employee: { id: 'emp_ana', name: 'Ana Souza', department: 'Financeiro' },
    conversationId: 'c1',
    now: NOW,
    history: [],
    userMessage: 'Qual o status do meu chamado?',
    sessionSummary: null,
    focusTicketId: null,
    pendingDraft: null,
    ...overrides,
  });

  const runner = (script: Parameters<typeof scriptedModel>[0]) =>
    new NexoAgentRunner(
      scriptedModel(script).model,
      repos.tickets,
      repos.drafts,
      repos.articles,
      repos.ids,
    );

  beforeEach(async () => {
    repos = createRepositories();
    events = { steps: [], text: '', blocks: [] };
    repos.tickets.tickets.push(
      buildTicket(),
      buildTicket({
        id: 'INC-20299',
        title: 'Acesso à pasta Financeiro',
        category: 'ACCESS',
        status: 'IN_PROGRESS',
      }),
      buildTicket({ id: 'INC-20321', requesterId: 'emp_bruno', title: 'VPN caindo' }),
    );
    await repos.conversations.create(
      ConversationEntity.start({ id: 'c1', employeeId: 'emp_ana' }, NOW),
    );
  });

  it('consulta, mostra o card, registra a decisão e transmite o texto', async () => {
    const result = await runner([
      { tools: [{ name: 'list_my_tickets', input: { onlyOpen: true } }] },
      {
        tools: [
          { name: 'get_my_ticket', input: { ticketId: 'inc-20311' } },
          {
            name: 'register_decision',
            input: {
              intent: 'TICKET_STATUS',
              understoodSummary: 'Quer o status do INC-20311',
              entities: { chamado: 'INC-20311' },
              actionLabel: 'mostrou o status e ofereceu analista',
              confidence: 0.92,
              rationale: 'Chamado identificado e vencido.',
              rulesApplied: ['Transferência: chamados vencidos'],
            },
          },
        ],
      },
      { text: 'Está sem atualização há 6 dias, acima do prazo. Quer que eu chame um analista?' },
    ]).run(input(), sink);

    expect(result.text).toBe(
      'Está sem atualização há 6 dias, acima do prazo. Quer que eu chame um analista?',
    );
    expect(events.text).toBe(result.text);
    expect(result.steps.map((step) => step.label)).toEqual([
      'consultou seus chamados',
      'consultou o INC-20311',
      'calculou o prazo',
    ]);
    expect(result.blocks[0]).toMatchObject({
      type: 'TICKET_CARD',
      ticket: { id: 'INC-20311', overdue: true },
    });
    expect(result.focusTicketId).toBe('INC-20311');
    expect(result.decision).toMatchObject({
      intent: 'TICKET_STATUS',
      confidence: { score: 0.92, band: 'HIGH' },
      rulesApplied: ['Anexo A · Transferência: chamados vencidos'],
      declaredByModel: true,
    });
    expect(result.usage.inputTokens).toBeGreaterThan(0);
    expect(events.steps.filter((step) => step.status === 'RUNNING')).toHaveLength(2);
  });

  it('não expõe chamado de outro funcionário mesmo se o modelo pedir', async () => {
    const result = await runner([
      { tools: [{ name: 'get_my_ticket', input: { ticketId: 'INC-20321' } }] },
      { text: 'Não encontrei esse chamado entre os seus.' },
    ]).run(input({ userMessage: 'me fala do INC-20321' }), sink);

    expect(result.steps[0]).toMatchObject({ tool: 'tickets.get', status: 'FAILED' });
    expect(result.blocks).toEqual([]);
    expect(repos.tickets.calls[0]?.args[0]).toBe('emp_ana');
  });

  it('monta o rascunho com prioridade calculada em código e detecta duplicidade', async () => {
    const result = await runner([
      {
        tools: [
          {
            name: 'draft_ticket',
            input: {
              type: 'INC',
              title: 'Notebook lento após atualização',
              description: 'Depois da atualização do Windows o notebook ficou muito lento.',
              category: 'HARDWARE',
              impact: 'SELF',
              blocksWork: false,
              sameDayCommitment: true,
            },
          },
        ],
      },
      {
        text: 'Já existe o INC-20311 sobre isso; preparei a atualização dele. Confira e confirme.',
      },
    ]).run(
      input({ userMessage: 'Meu notebook está lento depois da atualização, tenho reunião hoje' }),
      sink,
    );

    expect(result.draft).toMatchObject({
      mode: 'UPDATE',
      targetTicketId: 'INC-20311',
      priority: 'HIGH',
      priorityRule: 'Alta: há um compromisso no mesmo dia',
      dueAt: at('2026-10-27T14:00:00').toISOString(),
    });
    expect(result.steps.map((step) => step.label)).toEqual([
      'verificou duplicidade',
      'classificou a prioridade',
      'consultou o SLA',
      'montou o rascunho',
    ]);
    expect(result.blocks).toEqual([{ type: 'DRAFT', draftId: result.draft?.id ?? '' }]);
    expect(
      repos.tickets.calls.some((call) => call.method === 'create' || call.method === 'addUpdate'),
    ).toBe(false);
  });

  it('refazer o rascunho cancela o anterior', async () => {
    const draftInput = {
      type: 'REQ',
      title: 'Licença do Figma',
      description: 'Preciso do Figma para o projeto novo de marketing.',
      category: 'SOFTWARE',
      impact: 'SELF',
      blocksWork: false,
      sameDayCommitment: false,
    };

    await runner([
      { tools: [{ name: 'draft_ticket', input: draftInput }] },
      { text: 'Confira.' },
    ]).run(input(), sink);
    await runner([
      {
        tools: [
          {
            name: 'draft_ticket',
            input: { ...draftInput, title: 'Licença do Figma Professional' },
          },
        ],
      },
      { text: 'Atualizei.' },
    ]).run(input(), sink);

    const statuses = (await repos.drafts.listByConversation('c1')).map((draft) => draft.status);
    expect(statuses).toEqual(['CANCELLED', 'PENDING']);
  });

  it('pergunta com opções rápidas e registra o pedido de transferência', async () => {
    const result = await runner([
      {
        tools: [
          {
            name: 'ask_quick_question',
            input: {
              question: 'Quem está sendo afetado?',
              options: ['Só eu', 'Minha equipe', 'Toda a empresa', 'Não sei'],
            },
          },
          {
            name: 'request_handoff',
            input: {
              reason: 'USER_REQUESTED',
              summary: 'Funcionária pediu para falar com um analista sobre a VPN.',
            },
          },
        ],
      },
      { text: 'Vou chamar um analista.' },
    ]).run(input(), sink);

    expect(result.blocks[0]).toMatchObject({
      type: 'QUICK_REPLIES',
      options: ['Só eu', 'Minha equipe', 'Toda a empresa', 'Não sei'],
    });
    expect(result.handoffRequest).toMatchObject({ reason: 'USER_REQUESTED' });
  });

  it('sem register_decision, infere a decisão e marca como inferida', async () => {
    const result = await runner([
      { tools: [{ name: 'search_help_center', input: { query: 'horário do service desk' } }] },
      { text: 'De segunda a sexta, das 8h às 18h.' },
    ]).run(input({ userMessage: 'Qual o horário?' }), sink);

    expect(result.decision).toMatchObject({
      intent: 'FAQ',
      declaredByModel: false,
      confidence: { band: 'MEDIUM' },
    });
  });

  it('sem chave da Anthropic, avisa que o agent está indisponível', async () => {
    const unconfigured = new NexoAgentRunner(
      null,
      repos.tickets,
      repos.drafts,
      repos.articles,
      repos.ids,
    );

    await expect(unconfigured.run(input(), sink)).rejects.toBeInstanceOf(AgentUnavailableError);
  });
});
