'use client';

import type { TicketSummaryDto } from '@nexo/shared';

import { TicketStatusBadge } from '@/components/conversation/status';
import { cn, formatShortDate } from '@/lib/utils';

type TicketSelectListProps = {
  tickets: TicketSummaryDto[];
  selectedId: string | null;
  disabled: boolean;
  onSelect: (ticket: TicketSummaryDto) => void;
};

/** Seleção entre os chamados abertos (Tela 3). Radio nativo: setas e espaço funcionam no teclado. */
export function TicketSelectList({
  tickets,
  selectedId,
  disabled,
  onSelect,
}: TicketSelectListProps) {
  const locked = disabled || selectedId !== null;

  return (
    <fieldset className="overflow-hidden rounded-xl border bg-card" disabled={locked}>
      <legend className="sr-only">Escolha o chamado</legend>
      {tickets.map((ticket) => {
        const selected = ticket.id === selectedId;
        return (
          <label
            key={ticket.id}
            className={cn(
              'flex items-center gap-3 border-b px-4 py-3 text-sm last:border-b-0',
              locked ? 'cursor-default' : 'cursor-pointer hover:bg-muted/60',
              selected && 'bg-accent/60',
              locked && !selected && 'opacity-60',
            )}
          >
            <input
              type="radio"
              name="ticket-picker"
              className="size-4 accent-primary"
              checked={selected}
              onChange={() => onSelect(ticket)}
            />
            <span className="w-20 shrink-0 font-medium tabular-nums">{ticket.id}</span>
            <span className="min-w-0 flex-1 truncate" title={ticket.title}>
              {ticket.title}
            </span>
            <span className="hidden sm:inline">
              <TicketStatusBadge status={ticket.status} />
            </span>
            <span className="w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
              {formatShortDate(ticket.createdAt)}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
