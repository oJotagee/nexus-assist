import type {
  AgentIntent,
  ConfidenceBand,
  HandoffReason,
  MessageAuthor,
  MessageBlock,
  TicketDraftDto,
  TraceStep,
} from '@nexo/shared';

export const AGENT_RUNNER = Symbol('AGENT_RUNNER');

export type AgentHistoryMessage = {
  author: MessageAuthor;
  authorName: string | null;
  text: string;
  blocks: MessageBlock[];
};

export type AgentTurnInput = {
  employee: { id: string; name: string; department: string };
  conversationId: string;
  now: Date;
  history: AgentHistoryMessage[];
  userMessage: string;
  sessionSummary: string | null;
  focusTicketId: string | null;
  pendingDraft: TicketDraftDto | null;
};

/** Eventos em tempo real do turno (viram SSE para o chat). */
export interface AgentTurnSink {
  step(step: TraceStep): void;
  textDelta(delta: string): void;
  block(block: MessageBlock): void;
}

/** O que o agent entendeu e decidiu, registrado por ele mesmo via tool estruturada. */
export type AgentDecision = {
  intent: AgentIntent;
  understood: { summary: string; entities: Record<string, string> };
  action: { type: string; label: string };
  confidence: { score: number; band: ConfidenceBand };
  rationale: string;
  rulesApplied: string[];
  /** false quando o modelo não registrou e a decisão foi inferida dos passos. */
  declaredByModel: boolean;
};

export type AgentTurnResult = {
  text: string;
  blocks: MessageBlock[];
  steps: TraceStep[];
  decision: AgentDecision;
  handoffRequest: { reason: HandoffReason; summary: string } | null;
  draft: TicketDraftDto | null;
  focusTicketId: string | null;
  usage: { model: string; inputTokens: number; outputTokens: number; latencyMs: number };
};

export interface AgentRunner {
  run(input: AgentTurnInput, sink: AgentTurnSink): Promise<AgentTurnResult>;
}

export class AgentUnavailableError extends Error {
  constructor(message = 'O assistente está indisponível no momento.') {
    super(message);
    this.name = 'AgentUnavailableError';
  }
}
