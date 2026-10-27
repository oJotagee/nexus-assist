import type { TicketImpact, TicketPriority, TicketType } from '../tickets';

// A prioridade combina impacto (quantas pessoas) e urgência (compromisso em risco).
// O LLM só extrai os fatos; a regra é aplicada aqui, em código, para ser auditável
// e para o trace poder citar exatamente qual linha do Anexo A foi usada.

export type PriorityInput = {
  type: TicketType;
  impact: TicketImpact;
  /** A pessoa (ou a equipe) não consegue trabalhar, sem alternativa. */
  blocksWork: boolean;
  /** Há um compromisso no mesmo dia que depende da solução. */
  sameDayCommitment: boolean;
};

export type PriorityDecision = {
  priority: TicketPriority;
  rule: string;
};

export function classifyPriority(input: PriorityInput): PriorityDecision {
  const { type, impact, blocksWork, sameDayCommitment } = input;

  if (impact !== 'SELF' && blocksWork) {
    return { priority: 'CRITICAL', rule: 'Crítica: algo parado para uma equipe ou para a empresa' };
  }

  if (type === 'REQ') {
    return sameDayCommitment || blocksWork
      ? { priority: 'MEDIUM', rule: 'Média: pedido com urgência, mas há alternativa' }
      : { priority: 'LOW', rule: 'Baixa: pedidos e melhorias sem urgência' };
  }

  if (impact !== 'SELF') {
    return {
      priority: 'HIGH',
      rule: 'Alta: afeta mais de uma pessoa, mas ainda há como trabalhar',
    };
  }

  if (blocksWork) {
    return { priority: 'HIGH', rule: 'Alta: impede uma pessoa de trabalhar' };
  }

  if (sameDayCommitment) {
    return { priority: 'HIGH', rule: 'Alta: há um compromisso no mesmo dia' };
  }

  return { priority: 'MEDIUM', rule: 'Média: atrapalha, mas há alternativa' };
}
