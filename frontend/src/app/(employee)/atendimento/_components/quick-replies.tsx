'use client';

import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

type QuickRepliesProps = {
  question: string;
  options: string[];
  answered: string | null;
  disabled: boolean;
  onSelect: (option: string) => void;
};

/** Pergunta com opções rápidas (Tela 2). Depois de respondida, a escolha fica marcada. */
export function QuickReplies({
  question,
  options,
  answered,
  disabled,
  onSelect,
}: QuickRepliesProps) {
  const locked = disabled || answered !== null;

  return (
    <fieldset className="space-y-2" disabled={locked}>
      <legend className="mb-2 text-sm font-semibold">{question}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = answered === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              aria-pressed={selected}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                selected
                  ? 'border-primary bg-accent text-accent-foreground'
                  : 'bg-white hover:border-primary/40 hover:bg-accent/50',
                locked && !selected && 'opacity-50',
                locked && 'cursor-default',
              )}
            >
              {selected && <Check className="size-3.5" />}
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
