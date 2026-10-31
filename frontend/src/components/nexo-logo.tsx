import { BotMessageSquare } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Marca do Nexo Assist: ícone lucide em um quadrado azul, o mesmo desenho do favicon. */
export function NexoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-[10px] bg-primary text-white shadow-sm',
        className,
      )}
    >
      <BotMessageSquare aria-hidden="true" strokeWidth={2} className="size-[62%]" />
    </span>
  );
}

export function NexoLogo({
  className,
  tone = 'dark',
  compact = false,
}: {
  className?: string;
  tone?: 'dark' | 'light';
  /** No mobile, só a marca: o nome some abaixo de sm. */
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2.5 text-base font-semibold tracking-tight whitespace-nowrap',
        tone === 'light' ? 'text-white' : 'text-foreground',
        className,
      )}
    >
      <NexoMark className={tone === 'light' ? 'bg-white text-primary' : undefined} />
      <span className={cn(compact && 'sr-only sm:not-sr-only')}>
        Nexo <span className={tone === 'light' ? 'text-sky-300' : 'text-primary'}>Assist</span>
      </span>
    </span>
  );
}
