import { ChevronRight } from 'lucide-react';

import { NexoLogo } from '@/components/nexo-logo';

type EmployeeTopbarProps = {
  title: string;
  status?: React.ReactNode;
};

/** Breadcrumb "Service desk de TI › …" e o status à direita (ex.: "Assistente online"). */
export function EmployeeTopbar({ title, status }: EmployeeTopbarProps) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-white px-4 sm:px-6">
      <nav aria-label="Você está em" className="flex items-center gap-1.5 text-sm">
        <NexoLogo className="mr-2 md:hidden" />
        <span className="hidden text-muted-foreground sm:inline">Service desk de TI</span>
        <ChevronRight className="hidden size-3.5 text-muted-foreground sm:inline" />
        <span className="font-medium">{title}</span>
      </nav>
      {status}
    </header>
  );
}
