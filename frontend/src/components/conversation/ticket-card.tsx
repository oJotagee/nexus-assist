import { TICKET_CATEGORY_LABEL, type TicketSummaryDto } from '@nexo/shared';

import { cn, formatDateTime, formatRelative } from '@/lib/utils';
import { PriorityLabel, TicketStatusBadge } from './status';

export function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{children}</dd>
    </div>
  );
}

/** Card do chamado (Tela 3): status, prazo e o destaque em vermelho quando vencido. */
export function TicketCard({
  ticket,
  className,
}: {
  ticket: TicketSummaryDto;
  className?: string;
}) {
  return (
    <article
      className={cn('rounded-xl border bg-card p-4 sm:p-5', className)}
      aria-label={`Chamado ${ticket.id}`}
    >
      <header className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Chamado · <span className="font-medium tabular-nums">{ticket.id}</span>
        </p>
        <TicketStatusBadge status={ticket.status} />
      </header>

      <h3 className="mt-2 text-lg leading-snug font-semibold">{ticket.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground" title={ticket.description}>
        {ticket.description}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
        <Detail label="Categoria">{TICKET_CATEGORY_LABEL[ticket.category]}</Detail>
        <Detail label="Prioridade">
          <PriorityLabel priority={ticket.priority} />
        </Detail>
        <Detail label="Aberto em">
          <span className="tabular-nums">{formatDateTime(ticket.createdAt)}</span>
        </Detail>
        <Detail label="Última atualização">
          <span className={cn('tabular-nums', ticket.overdue && 'text-danger')}>
            {formatRelative(ticket.lastUpdateAt)}
          </span>
          {ticket.overdue && (
            <span className="block text-xs font-normal text-danger">prazo vencido</span>
          )}
        </Detail>
      </dl>
    </article>
  );
}
