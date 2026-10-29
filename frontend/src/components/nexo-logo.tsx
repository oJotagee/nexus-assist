import { LifeBuoy } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Marca do Nexo Assist: ícone lucide de suporte (LifeBuoy). */
export function NexoMark({ className }: { className?: string }) {
  return <LifeBuoy aria-hidden="true" strokeWidth={2.25} className={cn('size-5', className)} />;
}

export function NexoLogo({
  className,
  tone = 'dark',
}: {
  className?: string;
  tone?: 'dark' | 'light';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-sm font-semibold tracking-tight',
        tone === 'light' ? 'text-white' : 'text-foreground',
        className,
      )}
    >
      <NexoMark className={tone === 'light' ? 'text-white' : 'text-primary'} />
      Nexo Assist
    </span>
  );
}
