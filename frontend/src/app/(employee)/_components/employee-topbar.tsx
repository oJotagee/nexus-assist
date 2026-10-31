import { ChevronRight, LogOut, MessageSquare, UserRound } from 'lucide-react';
import Link from 'next/link';

import { signOutAction } from '../_actions/sign-out';
import { NexoLogo } from '@/components/nexo-logo';

type EmployeeTopbarProps = {
  title: string;
  status?: React.ReactNode;
};

const mobileLink =
  'grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/**
 * Breadcrumb "Service desk de TI › …" e o status à direita (ex.: "Assistente online").
 * No mobile, onde a sidebar some, também leva os atalhos de navegação.
 */
export function EmployeeTopbar({ title, status }: EmployeeTopbarProps) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-white px-4 sm:px-6">
      <nav aria-label="Você está em" className="flex min-w-0 items-center gap-1.5 text-sm">
        <NexoLogo compact className="mr-2 md:hidden" />
        <span className="hidden text-muted-foreground sm:inline">Service desk de TI</span>
        <ChevronRight className="hidden size-3.5 text-muted-foreground sm:inline" />
        <span className="truncate font-medium">{title}</span>
      </nav>

      <div className="flex items-center gap-1">
        {status && <span className="hidden sm:inline-flex">{status}</span>}
        <nav aria-label="Principal" className="flex items-center md:hidden">
          <Link href="/atendimento" className={mobileLink} aria-label="Atendimento">
            <MessageSquare className="size-[18px]" />
          </Link>
          <Link href="/perfil" className={mobileLink} aria-label="Meu perfil">
            <UserRound className="size-[18px]" />
          </Link>
          <form action={signOutAction}>
            <button type="submit" className={mobileLink} aria-label="Sair">
              <LogOut className="size-[18px]" />
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
