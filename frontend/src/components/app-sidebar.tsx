'use client';

import { ChevronLeft, ChevronRight, LogOut, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

import { signOutAction } from '@/app/(employee)/_actions/sign-out';
import { NexoLogo, NexoMark } from '@/components/nexo-logo';
import { SIDEBAR_COOKIE } from '@/lib/sidebar-cookie';
import { cn, getInitials } from '@/lib/utils';

export type SidebarItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  badge?: number;
};

type AppSidebarProps = {
  items: SidebarItem[];
  user: { name: string; detail: string; available?: boolean };
  initialCollapsed: boolean;
};

const ONE_YEAR = 60 * 60 * 24 * 365;

const focusRing = 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/** Sidebar do desktop, recolhível para só os ícones. No mobile ela some; cada tela tem seu topo. */
export function AppSidebar({ items, user, initialCollapsed }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    // biome-ignore lint/suspicious/noDocumentCookie: a Cookie Store API ainda não existe em todos os navegadores.
    document.cookie = `${SIDEBAR_COOKIE}=${next ? 'collapsed' : 'expanded'}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
  }

  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col overflow-hidden border-r bg-white transition-[width] duration-200 motion-reduce:transition-none md:flex',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <Link
        href={items[0]?.href ?? '/'}
        aria-label="Nexo Assist"
        className={cn('flex h-16 shrink-0 items-center', collapsed ? 'justify-center' : 'px-5')}
      >
        {collapsed ? <NexoMark /> : <NexoLogo />}
      </Link>

      <nav aria-label="Principal" className="flex flex-1 flex-col gap-1 px-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            aria-label={
              item.badge ? `${item.label}, ${item.badge} aguardando atendente` : item.label
            }
            aria-current={item.active ? 'page' : undefined}
            className={cn(
              'relative flex h-10 items-center gap-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              focusRing,
              collapsed ? 'justify-center' : 'px-3',
              item.active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <item.icon className="size-[18px] shrink-0" strokeWidth={1.75} />
            {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
            {!!item.badge && (
              <span
                className={cn(
                  'grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white tabular-nums',
                  collapsed && 'absolute top-0.5 right-0.5',
                )}
              >
                {item.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="space-y-2 border-t p-3">
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <span
            className="relative grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
            title={collapsed ? `${user.name} · ${user.detail}` : undefined}
          >
            {getInitials(user.name)}
            {user.available && (
              <span
                className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-white bg-emerald-500"
                aria-hidden="true"
              />
            )}
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground" title={user.detail}>
                {user.detail}
              </p>
            </div>
          )}
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            aria-label="Sair"
            title={collapsed ? 'Sair' : undefined}
            className={cn(
              'flex h-9 w-full items-center gap-2.5 rounded-lg text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              focusRing,
              collapsed ? 'justify-center' : 'px-3',
            )}
          >
            <LogOut className="size-4 shrink-0" />
            {!collapsed && 'Sair'}
          </button>
        </form>

        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className={cn(
            'grid h-9 w-full place-items-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            focusRing,
          )}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>
    </aside>
  );
}
