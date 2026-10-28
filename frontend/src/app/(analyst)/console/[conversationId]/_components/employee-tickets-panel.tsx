'use client';

import {
  HANDOFF_REASON_LABEL,
  TICKET_CATEGORY_LABEL,
  TICKET_PRIORITY_LABEL,
  type ConsoleConversationDto,
} from '@nexo/shared';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronRight,
  UserCheck,
  X,
} from 'lucide-react';
import { useState } from 'react';

import { TicketStatusBadge } from '@/components/conversation/status';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatRelative, formatTime } from '@/lib/utils';
import { getEmployeeTickets } from '../../_data-access/console';
import { AllTicketsDialog } from './all-tickets-dialog';

type EmployeeTicketsPanelProps = {
  conversation: ConsoleConversationDto;
  onClose?: () => void;
  className?: string;
};

/** Painel direito (Telas 4 e 5): chamado desta conversa em destaque e os demais do funcionário. */
export function EmployeeTicketsPanel({
  conversation,
  onClose,
  className,
}: EmployeeTicketsPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const firstName = conversation.employee.name.split(' ')[0];

  const tickets = useQuery({
    queryKey: ['console', 'tickets', conversation.id],
    queryFn: () => getEmployeeTickets(conversation.id),
    refetchInterval: 15_000,
  });

  const focus = tickets.data?.find((ticket) => ticket.id === conversation.focusTicketId);
  const others = (tickets.data ?? [])
    .filter((ticket) => ticket.id !== conversation.focusTicketId)
    .slice(0, 5);

  return (
    <aside
      aria-label={`Chamados de ${firstName}`}
      className={cn('flex w-80 shrink-0 flex-col border-l bg-white', className)}
    >
      <header className="flex items-start justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Chamados de {firstName}</h2>
          <p className="text-xs text-muted-foreground">
            {conversation.employee.department}
            {tickets.data &&
              ` · ${tickets.data.filter((ticket) => ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED').length} em aberto`}
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon-sm" aria-label="Fechar painel" onClick={onClose}>
            <X />
          </Button>
        )}
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {tickets.isPending && (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {tickets.isError && (
          <div role="alert" className="space-y-2 rounded-lg bg-danger-soft p-3 text-sm text-danger">
            <p className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {tickets.error.message}
            </p>
            <Button size="sm" variant="outline" onClick={() => tickets.refetch()}>
              Tentar novamente
            </Button>
          </div>
        )}

        {tickets.data && (
          <>
            <section>
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">Desta conversa</h3>
              {focus ? (
                <article className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-muted-foreground tabular-nums">
                      {focus.id}
                    </span>
                    <TicketStatusBadge status={focus.status} />
                  </div>
                  <p className="mt-1.5 text-sm leading-snug font-semibold">{focus.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {TICKET_CATEGORY_LABEL[focus.category]} · prioridade{' '}
                    {TICKET_PRIORITY_LABEL[focus.priority].toLowerCase()}
                    {focus.overdue && <span className="font-medium text-danger"> · vencido</span>}
                  </p>
                  {conversation.state === 'WITH_ANALYST' && conversation.assignedAnalyst ? (
                    <p className="mt-2.5 flex items-center gap-1.5 border-t pt-2.5 text-xs text-success">
                      <UserCheck className="size-3.5" />
                      Assumido por {conversation.assignedAnalyst.name}
                    </p>
                  ) : conversation.state === 'WAITING_ANALYST' ? (
                    <p className="mt-2.5 flex items-center gap-1.5 border-t pt-2.5 text-xs text-muted-foreground">
                      <ArrowLeftRight className="size-3.5" />
                      Transferido para um analista
                      {conversation.handoffAt && (
                        <span className="ml-auto tabular-nums">
                          {formatTime(conversation.handoffAt)}
                        </span>
                      )}
                    </p>
                  ) : null}
                </article>
              ) : (
                <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                  Nenhum chamado ligado a esta conversa ainda.
                </p>
              )}
            </section>

            {others.length > 0 && (
              <section>
                <h3 className="mb-1 text-xs font-medium text-muted-foreground">Outros chamados</h3>
                <ul className="-mx-2">
                  {others.map((ticket) => (
                    <li key={ticket.id} className="flex items-center gap-2 rounded-md px-2 py-2">
                      <TicketStatusBadge status={ticket.status} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium" title={ticket.title}>
                          {ticket.title}
                        </span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {ticket.id} · {formatRelative(ticket.lastUpdateAt)}
                        </span>
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {conversation.handoffReason && conversation.state === 'WAITING_ANALYST' && (
              <p className="text-xs text-muted-foreground">
                Motivo da transferência:{' '}
                <span className="font-medium text-foreground">
                  {HANDOFF_REASON_LABEL[conversation.handoffReason]}
                </span>
              </p>
            )}
          </>
        )}
      </div>

      <footer className="border-t p-3">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowAll(true)}
          disabled={!tickets.data}
        >
          Ver todos os chamados de {firstName}
          <ArrowUpRight />
        </Button>
      </footer>

      <AllTicketsDialog
        open={showAll}
        onOpenChange={setShowAll}
        employeeName={conversation.employee.name}
        tickets={tickets.data ?? []}
      />
    </aside>
  );
}
