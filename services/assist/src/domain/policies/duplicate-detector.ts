import type { DraftMode, TicketCategory, TicketStatus } from '@nexo/shared';

import { jaccard } from './text-similarity';

export type DuplicateCandidate = {
  id: string;
  title: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  canReopen: boolean;
};

export type DuplicateMatch = {
  ticketId: string;
  mode: Exclude<DraftMode, 'CREATE'>;
  similarity: number;
  reason: string;
};

const OPEN_STATUSES: TicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_ANALYST',
  'WAITING_REQUESTER',
  'APPROVED',
];

export const DUPLICATE_THRESHOLD = 0.3;

/**
 * Anexo A, "Sem duplicidade": se já existe um chamado aberto sobre o mesmo problema, ele é
 * atualizado; chamados resolvidos há até 7 dias podem ser reabertos. Compara só chamados da
 * mesma categoria, pelo título e descrição.
 */
export function findDuplicate(
  draft: { title: string; description: string; category: TicketCategory },
  tickets: DuplicateCandidate[],
): DuplicateMatch | null {
  const draftText = `${draft.title} ${draft.description}`;

  const scored = tickets
    .filter((ticket) => ticket.category === draft.category)
    .filter((ticket) => OPEN_STATUSES.includes(ticket.status) || ticket.canReopen)
    .map((ticket) => ({
      ticket,
      similarity: Math.max(
        jaccard(draft.title, ticket.title),
        jaccard(draftText, `${ticket.title} ${ticket.description}`),
      ),
    }))
    .filter(({ similarity }) => similarity >= DUPLICATE_THRESHOLD)
    .sort((a, b) => {
      const openA = OPEN_STATUSES.includes(a.ticket.status) ? 0 : 1;
      const openB = OPEN_STATUSES.includes(b.ticket.status) ? 0 : 1;
      return openA - openB || b.similarity - a.similarity;
    });

  const best = scored[0];
  if (!best) return null;

  const isOpen = OPEN_STATUSES.includes(best.ticket.status);
  const similarity = Math.round(best.similarity * 100) / 100;

  return {
    ticketId: best.ticket.id,
    mode: isOpen ? 'UPDATE' : 'REOPEN',
    similarity,
    reason: isOpen
      ? `Já existe o chamado aberto ${best.ticket.id} sobre o mesmo problema (similaridade ${similarity}); ele será atualizado.`
      : `O chamado ${best.ticket.id} sobre o mesmo problema foi resolvido há até 7 dias (similaridade ${similarity}); ele será reaberto.`,
  };
}
