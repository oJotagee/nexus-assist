import type {
  TicketCategory,
  TicketImpact,
  TicketPriority,
  TicketStatus,
  TicketType,
} from '@nexo/shared';

import type { TicketEntity, TicketUpdate } from '@/domain/entities/ticket.entity';

// O legado já entrega o prazo calculado: quem consome (agent, console) não precisa
// reimplementar a regra de horas úteis.
export type TicketView = {
  id: string;
  type: TicketType;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  impact: TicketImpact;
  status: TicketStatus;
  requesterId: string;
  assignedGroup: string | null;
  assigneeName: string | null;
  createdAt: Date;
  lastUpdateAt: Date;
  resolvedAt: Date | null;
  deadline: { dueAt: Date | null; overdue: boolean; slaLabel: string };
  canReopen: boolean;
};

export type TicketDetailView = TicketView & { updates: TicketUpdate[] };

export function toTicketView(ticket: TicketEntity, now: Date): TicketView {
  return {
    ...ticket.toJSON(),
    deadline: ticket.deadline(now),
    canReopen: ticket.canReopen(now),
  };
}
