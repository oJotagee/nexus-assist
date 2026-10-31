'use client';

import type { SupportLevel } from '@nexo/shared';
import { useQuery } from '@tanstack/react-query';
import { MessagesSquare } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { listConsoleConversations } from '../_data-access/console';
import { AppSidebar } from '@/components/app-sidebar';
import { ConversationList } from './conversation-list';
import { cn } from '@/lib/utils';

export type ConsoleAnalyst = { id: string; name: string; supportLevel: SupportLevel | null };

/**
 * Console do analista (Telas 4 e 5): sidebar · lista de conversas · conversa (children).
 * A sidebar começa recolhida porque a tela já tem três colunas. No mobile, lista e conversa
 * viram navegação em pilha.
 */
export function ConsoleShell({
  analyst,
  initialCollapsed,
  children,
}: {
  analyst: ConsoleAnalyst;
  initialCollapsed: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const inConversation = pathname !== '/console';

  const counts = useQuery({
    queryKey: ['console', 'list', 'all', ''],
    queryFn: () => listConsoleConversations({ filter: 'all' }),
    refetchInterval: 4000,
    select: (data) => data.counts,
  });

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <AppSidebar
        items={[
          {
            href: '/console',
            label: 'Conversas',
            icon: MessagesSquare,
            active: true,
            badge: counts.data?.waiting,
          },
        ]}
        user={{
          name: analyst.name,
          detail: analyst.supportLevel ? `Suporte ${analyst.supportLevel}` : 'Disponível',
          available: true,
        }}
        initialCollapsed={initialCollapsed}
      />

      <ConversationList className={cn(inConversation && 'hidden lg:flex')} />

      <div className={cn('min-w-0 flex-1', !inConversation && 'hidden lg:flex')}>{children}</div>
    </div>
  );
}
