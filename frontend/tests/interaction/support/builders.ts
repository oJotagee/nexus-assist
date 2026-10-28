import type {
  ConsoleConversationDto,
  ConversationDto,
  DecisionTraceDto,
  TicketDraftDto,
} from '@nexo/shared';

export function buildDraft(overrides: Partial<TicketDraftDto> = {}): TicketDraftDto {
  return {
    id: 'draft-1',
    mode: 'CREATE',
    targetTicketId: null,
    type: 'INC',
    title: 'VPN não conecta no notebook — erro 809',
    description: 'Desde ontem, Windows 11. Reunião com cliente às 14h.',
    category: 'NETWORK_VPN',
    priority: 'HIGH',
    priorityRule: 'Alta: há um compromisso no mesmo dia',
    impact: 'SELF',
    dueAt: new Date(Date.now() + 4 * 3_600_000).toISOString(),
    status: 'PENDING',
    resultTicketId: null,
    ...overrides,
  };
}

export function buildConversation(overrides: Partial<ConversationDto> = {}): ConversationDto {
  return {
    id: 'conv-1',
    state: 'AGENT',
    handoffReason: null,
    handoffSummary: null,
    handoffGroup: null,
    handoffAt: null,
    assignedAnalyst: null,
    session: { id: 's1', index: 0, messageCount: 2, limit: 30 },
    messages: [],
    drafts: [],
    ...overrides,
  };
}

export function buildConsoleConversation(
  overrides: Partial<ConsoleConversationDto> = {},
): ConsoleConversationDto {
  return {
    ...buildConversation({
      state: 'WAITING_ANALYST',
      handoffReason: 'OVERDUE',
      handoffSummary: 'Ana Souza — INC-20311 vencido há 6 dias; pediu analista.',
      handoffGroup: 'N2',
      handoffAt: new Date(Date.now() - 6 * 60_000).toISOString(),
    }),
    employee: {
      id: 'emp_ana',
      name: 'Ana Souza',
      email: 'ana.souza@nexo.com.br',
      department: 'Financeiro',
    },
    focusTicketId: 'INC-20311',
    ...overrides,
  };
}

export function buildTrace(overrides: Partial<DecisionTraceDto> = {}): DecisionTraceDto {
  return {
    intent: 'TICKET_STATUS',
    understood: { summary: 'Quer o status do INC-20311.', entities: { chamado: 'INC-20311' } },
    action: { type: 'TICKET_STATUS', label: 'mostrou o status e ofereceu analista' },
    confidence: { score: 0.92, band: 'HIGH' },
    rationale: 'O chamado está vencido; pela regra, ofereci um analista.',
    rulesApplied: ['Anexo A · Transferência: chamados vencidos'],
    steps: [
      {
        id: 's1',
        tool: 'tickets.get',
        label: 'consultou o INC-20311',
        status: 'RETRIED',
        attempts: 2,
        durationMs: 640,
        outputSummary: 'Aguardando analista, prazo vencido',
      },
    ],
    usage: { model: 'gemini-3.8-flash', inputTokens: 2310, outputTokens: 120, latencyMs: 1800 },
    ...overrides,
  };
}
