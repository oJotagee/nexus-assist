import { cn } from '@/lib/utils';

export function NexoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('size-5', className)}>
      <path d="M4 20V4h3.2l9.6 10.4V4H20v16h-3.2L7.2 9.6V20H4Z" fill="currentColor" />
    </svg>
  );
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
