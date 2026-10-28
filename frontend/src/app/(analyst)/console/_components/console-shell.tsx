'use client';

import type { SupportLevel } from '@nexo/shared';
import { useQuery } from '@tanstack/react-query';
import { LogOut, MessagesSquare } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NexoMark } from '@/components/nexo-logo';
import { cn, getInitials } from '@/lib/utils';
import { signOutAction } from '../../../(employee)/_actions/sign-out';
import { listConsoleConversations } from '../_data-access/console';
import { ConversationList } from './conversation-list';

export type ConsoleAnalyst = { id: string; name: string; supportLevel: SupportLevel | null };

/**
 * Console do analista (Telas 4 e 5): rail · lista de conversas · conversa (children).
 * No mobile, lista e conversa viram navegação em pilha.
 */
export function ConsoleShell({
  analyst,
  children,
}: {
  analyst: ConsoleAnalyst;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const inConversation = pathname !== '/console';

  // Contagem para o badge do rail; compartilha cache com a lista (mesma chave do filtro "todas").
  const counts = useQuery({
    queryKey: ['console', 'list', 'all', ''],
    queryFn: () => listConsoleConversations({ filter: 'all' }),
    refetchInterval: 4000,
    select: (data) => data.counts,
  });

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <nav
        aria-label="Console"
        className="hidden w-14 shrink-0 flex-col items-center border-r bg-white py-4 sm:flex"
      >
        <Link
          href="/console"
          aria-label="Nexo Assist — conversas"
          className="grid size-9 place-items-center rounded-lg bg-primary text-white"
        >
          <NexoMark className="size-4" />
        </Link>
        <Link
          href="/console"
          aria-current="page"
          className="relative mt-6 grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label={`Conversas${counts.data?.waiting ? `, ${counts.data.waiting} aguardando atendente` : ''}`}
        >
          <MessagesSquare className="size-5" strokeWidth={1.75} />
          {!!counts.data?.waiting && (
            <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white tabular-nums">
              {counts.data.waiting}
            </span>
          )}
        </Link>

        <div className="mt-auto flex flex-col items-center gap-3">
          <span
            className="relative grid size-9 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
            title={`${analyst.name} · disponível`}
          >
            {getInitials(analyst.name)}
            <span
              className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-white bg-emerald-500"
              aria-hidden="true"
            />
          </span>
          <form action={signOutAction}>
            <button
              type="submit"
              aria-label="Sair"
              className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </nav>

      <ConversationList className={cn(inConversation && 'hidden lg:flex')} />

      <div className={cn('min-w-0 flex-1', !inConversation && 'hidden lg:flex')}>{children}</div>
    </div>
  );
}
