import {
  PAUSED_STATUSES,
  TERMINAL_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from '../tickets';
import { BUSINESS_MINUTES_PER_DAY, addBusinessMinutes } from './business-hours';

type SlaRule =
  | { kind: 'calendar'; minutes: number; label: string }
  | { kind: 'business'; minutes: number; label: string };

export const SLA_BY_PRIORITY: Record<TicketPriority, SlaRule> = {
  CRITICAL: { kind: 'calendar', minutes: 60, label: '1 hora' },
  HIGH: { kind: 'business', minutes: 4 * 60, label: '4 horas úteis' },
  MEDIUM: { kind: 'business', minutes: 3 * BUSINESS_MINUTES_PER_DAY, label: '3 dias úteis' },
  LOW: { kind: 'business', minutes: 5 * BUSINESS_MINUTES_PER_DAY, label: '5 dias úteis' },
};

export const REOPEN_WINDOW_DAYS = 7;

export function computeDueAt(priority: TicketPriority, from: Date): Date {
  const rule = SLA_BY_PRIORITY[priority];

  return rule.kind === 'calendar'
    ? new Date(from.getTime() + rule.minutes * 60 * 1000)
    : addBusinessMinutes(from, rule.minutes);
}

export type TicketDeadlineInput = {
  priority: TicketPriority;
  status: TicketStatus;
  lastUpdateAt: Date;
};

export type TicketDeadline = {
  /** null quando o prazo não corre (resolvido, fechado ou aguardando o funcionário). */
  dueAt: Date | null;
  overdue: boolean;
  slaLabel: string;
};

export function getTicketDeadline(ticket: TicketDeadlineInput, now: Date): TicketDeadline {
  const slaLabel = SLA_BY_PRIORITY[ticket.priority].label;

  if (TERMINAL_STATUSES.includes(ticket.status) || PAUSED_STATUSES.includes(ticket.status)) {
    return { dueAt: null, overdue: false, slaLabel };
  }

  const dueAt = computeDueAt(ticket.priority, ticket.lastUpdateAt);

  return { dueAt, overdue: now.getTime() > dueAt.getTime(), slaLabel };
}

export type ReopenInput = {
  status: TicketStatus;
  resolvedAt: Date | null;
};

/** Chamados resolvidos há até 7 dias podem ser reabertos em vez de duplicados. */
export function canReopen(ticket: ReopenInput, now: Date): boolean {
  if (ticket.status !== 'RESOLVED' || !ticket.resolvedAt) return false;

  const windowMs = REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - ticket.resolvedAt.getTime() <= windowMs;
}
