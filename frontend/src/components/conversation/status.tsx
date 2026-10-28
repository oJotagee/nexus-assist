import {
  TICKET_PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
  type TicketPriority,
  type TicketStatus,
} from '@nexo/shared';
import { ChevronDown, ChevronsUp, Equal, OctagonAlert } from 'lucide-react';

import { cn } from '@/lib/utils';

export type Tone = 'warning' | 'info' | 'success' | 'danger' | 'neutral';

const TONE_CLASS: Record<Tone, { text: string; bg: string; dot: string }> = {
  warning: { text: 'text-warning', bg: 'bg-warning-soft', dot: 'bg-amber-500' },
  info: { text: 'text-info', bg: 'bg-info-soft', dot: 'bg-blue-500' },
  success: { text: 'text-success', bg: 'bg-success-soft', dot: 'bg-emerald-500' },
  danger: { text: 'text-danger', bg: 'bg-danger-soft', dot: 'bg-red-500' },
  neutral: { text: 'text-slate-600', bg: 'bg-muted', dot: 'bg-slate-400' },
};

const STATUS_TONE: Record<TicketStatus, Tone> = {
  OPEN: 'info',
  IN_PROGRESS: 'info',
  WAITING_ANALYST: 'warning',
  WAITING_REQUESTER: 'warning',
  APPROVED: 'success',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};

/** Status sempre com texto + ponto colorido (nunca só cor). */
export function StatusDot({
  tone,
  children,
  className,
  pill = false,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
  pill?: boolean;
}) {
  const classes = TONE_CLASS[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap',
        classes.text,
        pill && cn('rounded-full px-2 py-0.5', classes.bg),
        className,
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', classes.dot)} aria-hidden="true" />
      {children}
    </span>
  );
}

export function TicketStatusBadge({ status, pill }: { status: TicketStatus; pill?: boolean }) {
  return (
    <StatusDot tone={STATUS_TONE[status]} pill={pill}>
      {TICKET_STATUS_LABEL[status]}
    </StatusDot>
  );
}

const PRIORITY_STYLE: Record<TicketPriority, { icon: typeof Equal; className: string }> = {
  CRITICAL: { icon: OctagonAlert, className: 'text-danger' },
  HIGH: { icon: ChevronsUp, className: 'text-warning' },
  MEDIUM: { icon: Equal, className: 'text-info' },
  LOW: { icon: ChevronDown, className: 'text-slate-500' },
};

export function PriorityLabel({ priority, suffix }: { priority: TicketPriority; suffix?: string }) {
  const { icon: Icon, className } = PRIORITY_STYLE[priority];
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-sm font-medium">
      <Icon className={cn('size-4', className)} aria-hidden="true" />
      {TICKET_PRIORITY_LABEL[priority]}
      {suffix && <span className="text-xs font-normal text-muted-foreground">· {suffix}</span>}
    </span>
  );
}
