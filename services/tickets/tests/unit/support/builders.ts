import { TicketEntity } from '@/domain/entities/ticket.entity';

export const at = (iso: string) => new Date(`${iso}-03:00`);
export const NOW = at('2026-10-27T10:00:00');

type TicketOverrides = Partial<Parameters<typeof TicketEntity.restore>[0]>;

export function buildTicket(overrides: TicketOverrides = {}): TicketEntity {
  return TicketEntity.restore({
    id: 'INC-20311',
    type: 'INC',
    title: 'Notebook lento após atualização do Windows',
    description: 'Lentidão geral desde a atualização.',
    category: 'HARDWARE',
    priority: 'MEDIUM',
    impact: 'SELF',
    status: 'WAITING_ANALYST',
    requesterId: 'emp_ana',
    assignedGroup: 'Suporte N1',
    assigneeName: null,
    createdAt: at('2026-10-16T14:20:00'),
    lastUpdateAt: at('2026-10-21T10:00:00'),
    resolvedAt: null,
    ...overrides,
  });
}
