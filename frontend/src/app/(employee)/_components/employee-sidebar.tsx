'use client';

import { LogOut, MessageSquare, UserRound } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

import { signOutAction } from '../_actions/sign-out';
import { NexoLogo } from '@/components/nexo-logo';
import { cn, getInitials } from '@/lib/utils';

const NAV = [
  { href: '/atendimento', label: 'Atendimento', icon: MessageSquare },
  { href: '/perfil', label: 'Meu perfil', icon: UserRound },
];

export function EmployeeSidebar({ user }: { user: { name: string; email: string } }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-white md:flex">
      <div className="px-5 py-5">
        <NexoLogo />
      </div>

      <nav aria-label="Principal" className="flex flex-1 flex-col gap-1 px-3">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="size-[18px]" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
            {getInitials(user.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground" title={user.email}>
              {user.email}
            </p>
          </div>
        </div>
        <form action={signOutAction} className="mt-3">
          <button
            type="submit"
            className="flex h-8 items-center gap-2 rounded-md px-1 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <LogOut className="size-4" />
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
