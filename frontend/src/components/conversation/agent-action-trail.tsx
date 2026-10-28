'use client';

import type { ConfidenceBand, TraceStep } from '@nexo/shared';
import { Check, Info, Loader2, RotateCw, X } from 'lucide-react';

import { cn } from '@/lib/utils';

const STEP_ICON: Record<
  TraceStep['status'],
  { icon: typeof Check; className: string; label: string }
> = {
  RUNNING: {
    icon: Loader2,
    className: 'animate-spin text-muted-foreground',
    label: 'em andamento',
  },
  OK: { icon: Check, className: 'text-emerald-600', label: 'concluído' },
  RETRIED: { icon: RotateCw, className: 'text-amber-600', label: 'concluído após repetir' },
  FAILED: { icon: X, className: 'text-red-600', label: 'falhou' },
};

type AgentActionTrailProps = {
  steps: Pick<TraceStep, 'id' | 'label' | 'status' | 'attempts'>[];
  confidence?: { score: number; band: ConfidenceBand };
  /** Abre o painel "Por que?"; ausente enquanto a resposta ainda está chegando. */
  onOpenDetails?: () => void;
};

/**
 * Linha acima de cada resposta do agent: "Nexo Assist · ✓ consultou seus chamados · ✓ …".
 * Cada ação é clicável e abre o detalhe da decisão (o que entendeu, ação, segurança, por quê).
 */
export function AgentActionTrail({ steps, confidence, onOpenDetails }: AgentActionTrailProps) {
  const lowConfidence = confidence?.band === 'LOW';

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">Nexo Assist</span>

      {steps.map((step) => {
        const { icon: Icon, className, label } = STEP_ICON[step.status];
        const content = (
          <>
            <Icon className={cn('size-3.5', className)} aria-hidden="true" />
            <span>
              {step.label}
              {step.status === 'RETRIED' && ` (${step.attempts} tentativas)`}
            </span>
            <span className="sr-only">: {label}</span>
          </>
        );

        return onOpenDetails ? (
          <button
            key={step.id}
            type="button"
            onClick={onOpenDetails}
            className="inline-flex items-center gap-1 rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {content}
          </button>
        ) : (
          <span key={step.id} className="inline-flex items-center gap-1">
            {content}
          </span>
        );
      })}

      {onOpenDetails && (
        <button
          type="button"
          onClick={onOpenDetails}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            lowConfidence ? 'border-amber-300 text-warning' : 'text-foreground',
          )}
        >
          <Info className="size-3" aria-hidden="true" />
          Por quê?
          {confidence && (
            <span className="tabular-nums text-muted-foreground">
              {Math.round(confidence.score * 100)}%
            </span>
          )}
        </button>
      )}
    </div>
  );
}
