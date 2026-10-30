import type {
  TicketCategory,
  TicketImpact,
  TicketPriority,
  TicketStatus,
  TicketType,
} from '../tickets';

export const SESSION_MESSAGE_LIMIT = 30;
export const MESSAGE_MAX_LENGTH = 2000;

export type EmployeeRole = 'EMPLOYEE' | 'ANALYST';
export type SupportLevel = 'N1' | 'N2';

export type UserDto = {
  id: string;
  name: string;
  email: string;
  department: string;
  role: EmployeeRole;
  supportLevel: SupportLevel | null;
  passwordChangedAt: string;
};

export type ConversationState = 'AGENT' | 'WAITING_ANALYST' | 'WITH_ANALYST' | 'CLOSED';
export type HandoffReason =
  | 'USER_REQUESTED'
  | 'CRITICAL'
  | 'OVERDUE'
  | 'LOW_CONFIDENCE'
  | 'RETURNED';

export const HANDOFF_REASON_LABEL: Record<HandoffReason, string> = {
  USER_REQUESTED: 'Pedido do funcionário',
  CRITICAL: 'Caso crítico',
  OVERDUE: 'Chamado com prazo vencido',
  LOW_CONFIDENCE: 'Agent sem segurança para decidir',
  RETURNED: 'Voltou: o problema continua',
};

export type TicketSummaryDto = {
  id: string;
  type: TicketType;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignedGroup: string | null;
  assigneeName: string | null;
  createdAt: string;
  lastUpdateAt: string;
  dueAt: string | null;
  overdue: boolean;
  slaLabel: string;
  canReopen: boolean;
};

export type DraftMode = 'CREATE' | 'UPDATE' | 'REOPEN';
export type DraftStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export type TicketDraftDto = {
  id: string;
  mode: DraftMode;
  targetTicketId: string | null;
  type: TicketType;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  priorityRule: string;
  impact: TicketImpact;
  dueAt: string;
  status: DraftStatus;
  resultTicketId: string | null;
};

export type MessageBlock =
  | { type: 'TICKET_CARD'; ticket: TicketSummaryDto }
  | { type: 'TICKET_PICKER'; tickets: TicketSummaryDto[]; selectedId: string | null }
  | { type: 'DRAFT'; draftId: string }
  | { type: 'QUICK_REPLIES'; question: string; options: string[]; answered: string | null }
  | { type: 'NOTICE'; tone: 'info' | 'warning' | 'error'; text: string };

export type MessageAuthor = 'EMPLOYEE' | 'AGENT' | 'ANALYST' | 'SYSTEM';

export type StepStatus = 'RUNNING' | 'OK' | 'RETRIED' | 'FAILED';

export type TraceStep = {
  id: string;
  tool: string;
  label: string;
  status: StepStatus;
  attempts: number;
  durationMs: number;
  input?: unknown;
  outputSummary?: string;
};

export const AGENT_INTENTS = [
  'FAQ',
  'TICKET_STATUS',
  'TICKET_UPDATE',
  'TICKET_CREATE',
  'HANDOFF',
  'CLARIFY',
  'OUT_OF_SCOPE',
  'SMALL_TALK',
] as const;
export type AgentIntent = (typeof AGENT_INTENTS)[number];

export const AGENT_INTENT_LABEL: Record<AgentIntent, string> = {
  FAQ: 'Dúvida',
  TICKET_STATUS: 'Consulta de chamado',
  TICKET_UPDATE: 'Complemento de chamado',
  TICKET_CREATE: 'Abertura de chamado',
  HANDOFF: 'Falar com analista',
  CLARIFY: 'Precisa de mais informação',
  OUT_OF_SCOPE: 'Fora do escopo de TI',
  SMALL_TALK: 'Conversa',
};

export type ConfidenceBand = 'HIGH' | 'MEDIUM' | 'LOW';

export function confidenceBand(score: number): ConfidenceBand {
  if (score >= 0.8) return 'HIGH';
  if (score >= 0.6) return 'MEDIUM';
  return 'LOW';
}

export type DecisionTraceDto = {
  intent: AgentIntent;
  understood: { summary: string; entities: Record<string, string> };
  action: { type: string; label: string };
  confidence: { score: number; band: ConfidenceBand };
  rationale: string;
  rulesApplied: string[];
  steps: TraceStep[];
  usage: { model: string; inputTokens: number; outputTokens: number; latencyMs: number };
};

export type MessageDto = {
  id: string;
  author: MessageAuthor;
  authorName: string | null;
  text: string;
  blocks: MessageBlock[];
  createdAt: string;
  /** Versão resumida para o trail acima da resposta; o detalhe vem de GET /traces/:messageId */
  trace: Pick<DecisionTraceDto, 'intent' | 'confidence' | 'steps' | 'action'> | null;
};

export type ConversationDto = {
  id: string;
  state: ConversationState;
  handoffReason: HandoffReason | null;
  handoffSummary: string | null;
  handoffGroup: SupportLevel | null;
  handoffAt: string | null;
  assignedAnalyst: { id: string; name: string; supportLevel: SupportLevel | null } | null;
  session: { id: string; index: number; messageCount: number; limit: number };
  messages: MessageDto[];
  drafts: TicketDraftDto[];
};

/** Eventos do stream SSE de POST /conversations/:id/messages */
export type AgentStreamEvent =
  /** A mensagem do funcionário gravada; agentWillReply diz se o agent vai responder (falso com analista). */
  | { type: 'message'; message: MessageDto; agentWillReply: boolean }
  | { type: 'step'; step: TraceStep }
  | { type: 'text-delta'; delta: string }
  | { type: 'block'; block: MessageBlock }
  | { type: 'done'; message: MessageDto | null; conversation: ConversationDto }
  | { type: 'error'; error: string; message: string };

export type ConsoleFilter = 'all' | 'waiting' | 'agent' | 'mine';

export type ConsoleConversationItemDto = {
  id: string;
  employee: { id: string; name: string; department: string };
  state: ConversationState;
  handoffReason: HandoffReason | null;
  handoffAt: string | null;
  assignedAnalyst: { id: string; name: string } | null;
  resolvedByAgent: boolean;
  lastMessage: { author: MessageAuthor; text: string; createdAt: string } | null;
  focusTicketId: string | null;
};

export type ConsoleConversationListDto = {
  items: ConsoleConversationItemDto[];
  counts: Record<ConsoleFilter, number>;
};

export type ConsoleConversationDto = ConversationDto & {
  employee: { id: string; name: string; email: string; department: string };
  focusTicketId: string | null;
};
