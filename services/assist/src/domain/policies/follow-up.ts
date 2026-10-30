import type { MessageBlock } from '@nexo/shared';

import { normalize } from './text-similarity';

/** Opções que o agent mostra quando o analista devolve a conversa. */
export const FOLLOW_UP_OPTIONS = {
  resolved: 'Resolveu, pode fechar o chamado',
  newProblem: 'Tenho outro problema',
  continues: 'O problema continua',
} as const;

export type FollowUpAnswer = 'RESOLVED' | 'NEW_PROBLEM' | 'CONTINUES';

const CONTINUES =
  /continua|nao resolveu|nao funcionou|ainda (nao|esta|da|continua)|mesmo problema|persiste|voltou a/;
const NEW_PROBLEM =
  /outro problema|outra coisa|novo problema|problema diferente|outra duvida|tenho outro/;
const RESOLVED =
  /resolveu|resolvido|pode fechar|pode encerrar|funcionou|deu certo|^sim\b|tudo certo|tudo ok/;

/**
 * Interpreta a resposta à pergunta "pode fechar o chamado?" (clique ou texto livre). Ordem importa:
 * "não resolveu" é checado antes de "resolveu". Devolve null quando não dá para saber; nesse caso a
 * mensagem é tratada como a descrição de um problema novo e segue para o agent.
 */
export function classifyFollowUpAnswer(text: string): FollowUpAnswer | null {
  const value = normalize(text).replace(/\s+/g, ' ').trim();

  if (value === normalize(FOLLOW_UP_OPTIONS.continues).trim() || CONTINUES.test(value)) {
    return 'CONTINUES';
  }
  if (value === normalize(FOLLOW_UP_OPTIONS.newProblem).trim() || NEW_PROBLEM.test(value)) {
    return 'NEW_PROBLEM';
  }
  if (RESOLVED.test(value)) return 'RESOLVED';

  return null;
}

/** Pergunta que o agent faz ao receber a conversa de volta do analista. */
export function followUpQuestion(ticketId: string | null): MessageBlock {
  return {
    type: 'QUICK_REPLIES',
    question: ticketId
      ? `O atendimento do ${ticketId} resolveu o seu problema?`
      : 'O atendimento resolveu o seu problema?',
    options: [
      FOLLOW_UP_OPTIONS.resolved,
      FOLLOW_UP_OPTIONS.newProblem,
      FOLLOW_UP_OPTIONS.continues,
    ],
    answered: null,
  };
}

/**
 * "Tenho outro problema" sozinho pede a descrição; com o problema já descrito na mesma mensagem
 * ("tenho outro problema: o mouse parou"), a mensagem segue direto para o agent.
 */
export function describesProblem(text: string): boolean {
  return normalize(text).split(/\s+/).filter(Boolean).length > 5;
}
