'use client';

import type { ConsoleFilter } from '@nexo/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlertCircle, MessageCircle, Search } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useDeferredValue, useState } from 'react';

import { StatusDot } from '@/components/conversation/status';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatTime, getInitials } from '@/lib/utils';
import { listConsoleConversations } from '../_data-access/console';
import { ConversationStatus } from './console-labels';
import { useConsoleActivity } from './use-console-activity';

const FILTERS: { value: ConsoleFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'waiting', label: 'Para você' },
  { value: 'agent', label: 'Com o agent' },
  { value: 'mine', label: 'Minhas' },
];

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-800',
  'bg-amber-100 text-amber-800',
  'bg-emerald-100 text-emerald-800',
  'bg-rose-100 text-rose-800',
  'bg-violet-100 text-violet-800',
  'bg-cyan-100 text-cyan-800',
];

function avatarColor(id: string): string {
  const sum = [...id].reduce((total, char) => total + char.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length] ?? AVATAR_COLORS[0] ?? '';
}

export function ConversationList({ className }: { className?: string }) {
  const params = useParams<{ conversationId?: string }>();
  const [filter, setFilter] = useState<ConsoleFilter>('all');
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim());

  const list = useQuery({
    queryKey: ['console', 'list', filter, query],
    queryFn: () => listConsoleConversations({ filter, query }),
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  const all = useQuery({
    queryKey: ['console', 'list', 'all', ''],
    queryFn: () => listConsoleConversations({ filter: 'all' }),
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
  const { isUnread } = useConsoleActivity(all.data?.items, params.conversationId);

  return (
    <aside
      aria-label="Conversas"
      className={cn('flex w-full shrink-0 flex-col border-r bg-white lg:w-80', className)}
    >
      <header className="space-y-3 border-b px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Conversas</h1>
          <StatusDot tone="success" pill>
            Disponível
          </StatusDot>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="console-search" className="sr-only">
            Pesquisar conversas ou chamados
          </label>
          <input
            id="console-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar conversas ou chamados"
            className="h-9 w-full rounded-lg border bg-muted/50 pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
          />
        </div>

        <div role="tablist" aria-label="Filtrar conversas" className="flex gap-1 overflow-x-auto">
          {FILTERS.map((item) => {
            const count = list.data?.counts[item.value];
            const active = filter === item.value;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(item.value)}
                className={cn(
                  'inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {item.label}
                {count !== undefined && <span className="tabular-nums opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {list.isPending && (
          <ul aria-busy="true" className="divide-y">
            {[0, 1, 2, 3, 4].map((row) => (
              <li key={row} className="flex gap-3 px-4 py-3">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {list.isError && (
          <div
            role="alert"
            className="m-4 space-y-2 rounded-lg bg-danger-soft p-3 text-sm text-danger"
          >
            <p className="flex items-center gap-2">
              <AlertCircle className="size-4" />
              {list.error.message}
            </p>
            <Button size="sm" variant="outline" onClick={() => list.refetch()}>
              Tentar novamente
            </Button>
          </div>
        )}

        {list.data && list.data.items.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {query ? `Nada encontrado para "${query}".` : 'Nenhuma conversa neste filtro.'}
          </p>
        )}

        <ul className="divide-y">
          {list.data?.items.map((item) => {
            const active = params.conversationId === item.id;
            const unread = isUnread(item);
            const preview = item.lastMessage
              ? `${item.lastMessage.author === 'AGENT' ? 'Nexo: ' : item.lastMessage.author === 'ANALYST' ? 'Você: ' : ''}${item.lastMessage.text}`
              : '';
            return (
              <li key={item.id}>
                <Link
                  href={`/console/${item.id}`}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'flex gap-3 px-4 py-3 transition-colors focus-visible:bg-muted focus-visible:outline-none',
                    active ? 'bg-accent/70' : 'hover:bg-muted/60',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold',
                      avatarColor(item.employee.id),
                    )}
                  >
                    {getInitials(item.employee.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">{item.employee.name}</span>
                        {unread && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            <MessageCircle className="size-2.5" aria-hidden="true" />
                            Nova
                          </span>
                        )}
                      </span>
                      {item.lastMessage && (
                        <span
                          className={cn(
                            'shrink-0 text-[11px] tabular-nums',
                            item.state === 'WAITING_ANALYST' || unread
                              ? 'font-semibold text-primary'
                              : 'text-muted-foreground',
                          )}
                        >
                          {formatTime(item.lastMessage.createdAt)}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground" title={preview}>
                      {preview}
                    </span>
                    <span className="mt-1 block truncate">
                      <ConversationStatus item={item} />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
