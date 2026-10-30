import type {
  AgentIntent,
  ConfidenceBand,
  HandoffReason,
  SupportLevel,
  TicketPriority,
} from '@nexo/shared';

export type HandoffInput = {
  intent: AgentIntent;
  confidenceBand: ConfidenceBand;
  /** Transferência pedida pelo próprio agent (tool request_handoff). */
  requested: { reason: HandoffReason; summary: string } | null;
  /** Prioridade do rascunho criado neste turno, se houver. */
  draftPriority: TicketPriority | null;
  /** O turno anterior do agent também foi uma pergunta de esclarecimento com baixa segurança. */
  previousWasLowConfidenceClarify: boolean;
};

export type HandoffDecision = {
  reason: HandoffReason;
  group: SupportLevel;
  forcedByPolicy: boolean;
  rule: string;
};

const RULES: Record<HandoffReason, string> = {
  USER_REQUESTED: 'Anexo A · Transferência: quando o funcionário pede',
  CRITICAL: 'Anexo A · Transferência: casos críticos',
  OVERDUE: 'Anexo A · Transferência: chamados vencidos',
  LOW_CONFIDENCE: 'Anexo A · Transferência: quando o agent não tem segurança sobre o que fazer',
  RETURNED: 'Atendimento devolvido: o mesmo problema continua, a conversa volta para o analista',
};

/** Casos críticos e vencidos vão para o N2; o resto começa no N1. */
function groupFor(reason: HandoffReason): SupportLevel {
  return reason === 'CRITICAL' || reason === 'OVERDUE' || reason === 'RETURNED' ? 'N2' : 'N1';
}

function decide(reason: HandoffReason, forcedByPolicy: boolean): HandoffDecision {
  return { reason, group: groupFor(reason), forcedByPolicy, rule: RULES[reason] };
}

/**
 * Regra de transferência aplicada em código depois de cada decisão do agent, para não
 * depender só do modelo "lembrar" do Anexo A:
 *
 * - o agent pediu → respeita o motivo dele;
 * - rascunho com prioridade crítica → transfere (o rascunho continua para confirmação);
 * - baixa segurança numa ação → transfere; numa pergunta de esclarecimento, só na segunda vez
 *   seguida (perguntar quando falta informação é a conduta certa).
 *
 * Chamado vencido não força: o agent oferece o analista (Tela 3) e o funcionário escolhe.
 */
export function evaluateHandoff(input: HandoffInput): HandoffDecision | null {
  if (input.requested) return decide(input.requested.reason, false);

  if (input.draftPriority === 'CRITICAL') return decide('CRITICAL', true);

  const lowConfidence = input.confidenceBand === 'LOW';
  const harmless = input.intent === 'SMALL_TALK' || input.intent === 'OUT_OF_SCOPE';

  if (lowConfidence && !harmless) {
    if (input.intent !== 'CLARIFY' || input.previousWasLowConfidenceClarify) {
      return decide('LOW_CONFIDENCE', true);
    }
  }

  return null;
}

export function handoffRule(reason: HandoffReason): string {
  return RULES[reason];
}
