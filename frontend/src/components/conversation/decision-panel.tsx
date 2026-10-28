'use client';

import { AGENT_INTENT_LABEL, type DecisionTraceDto, type TraceStep } from '@nexo/shared';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, Loader2, RotateCw, X } from 'lucide-react';

import { getDecisionTrace } from '@/app/_data-access/get-decision-trace';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const BAND = {
  HIGH: { label: 'Alta', bar: 'bg-emerald-500', text: 'text-success' },
  MEDIUM: { label: 'Média', bar: 'bg-amber-500', text: 'text-warning' },
  LOW: { label: 'Baixa', bar: 'bg-red-500', text: 'text-danger' },
} as const;

const STEP_ICON: Record<TraceStep['status'], { icon: typeof Check; className: string }> = {
  RUNNING: { icon: Loader2, className: 'text-muted-foreground animate-spin' },
  OK: { icon: Check, className: 'text-emerald-600' },
  RETRIED: { icon: RotateCw, className: 'text-amber-600' },
  FAILED: { icon: X, className: 'text-red-600' },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function TraceBody({ trace }: { trace: DecisionTraceDto }) {
  const band = BAND[trace.confidence.band];
  const entities = Object.entries(trace.understood.entities);
  const isAgentDecision = trace.usage.inputTokens > 0;

  return (
    <div className="space-y-6">
      <Section title="Entendi">
        <p className="text-sm leading-relaxed">{trace.understood.summary}</p>
        <p className="text-xs text-muted-foreground">
          Intenção:{' '}
          <span className="font-medium text-foreground">{AGENT_INTENT_LABEL[trace.intent]}</span>
        </p>
        {entities.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {entities.map(([key, value]) => (
              <li key={key} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                <span className="text-muted-foreground">{key}:</span> {value}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Ação">
        <p className="text-sm font-medium first-letter:uppercase">{trace.action.label}</p>
      </Section>

      <Section title="Segurança">
        <div className="flex items-center gap-3">
          {/* biome-ignore lint/a11y/useSemanticElements: <meter> não aceita o estilo da barra; role=meter mantém a semântica. */}
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(trace.confidence.score * 100)}
            aria-label="Segurança da decisão"
          >
            <div
              className={cn('h-full rounded-full', band.bar)}
              style={{ width: `${trace.confidence.score * 100}%` }}
            />
          </div>
          <span className={cn('text-sm font-semibold tabular-nums', band.text)}>
            {Math.round(trace.confidence.score * 100)}% · {band.label}
          </span>
        </div>
        {trace.confidence.band === 'LOW' && (
          <p className="flex items-start gap-1.5 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Abaixo de 60%, a regra do service desk é transferir para um analista.
          </p>
        )}
      </Section>

      <Section title="Por quê">
        <p className="text-sm leading-relaxed">{trace.rationale}</p>
        {trace.rulesApplied.length > 0 && (
          <ul className="space-y-1">
            {trace.rulesApplied.map((rule) => (
              <li
                key={rule}
                className="rounded-md border-l-2 border-primary bg-accent/60 px-2.5 py-1.5 text-xs text-accent-foreground"
              >
                {rule}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {trace.steps.length > 0 && (
        <Section title="Passos">
          <ol className="relative space-y-3 border-l pl-4">
            {trace.steps.map((step) => {
              const { icon: Icon, className } = STEP_ICON[step.status];
              return (
                <li key={step.id} className="relative">
                  <span className="absolute top-0.5 -left-[25px] grid size-4 place-items-center rounded-full border bg-white">
                    <Icon className={cn('size-2.5', className)} />
                  </span>
                  <p className="text-sm font-medium first-letter:uppercase">{step.label}</p>
                  {step.outputSummary && (
                    <p className="text-xs text-muted-foreground">{step.outputSummary}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {step.tool} · {step.durationMs} ms
                    {step.attempts > 1 &&
                      ` · ${step.attempts} tentativas (sistema de chamados instável)`}
                  </p>
                </li>
              );
            })}
          </ol>
        </Section>
      )}

      <Section title="Custo">
        <p className="text-xs text-muted-foreground tabular-nums">
          {isAgentDecision
            ? `${trace.usage.model} · ${trace.usage.inputTokens.toLocaleString('pt-BR')} tokens de entrada · ${trace.usage.outputTokens.toLocaleString('pt-BR')} de saída · ${(trace.usage.latencyMs / 1000).toFixed(1)} s`
            : `Sem uso do modelo (${trace.usage.model}).`}
        </p>
      </Section>
    </div>
  );
}

type DecisionPanelProps = {
  messageId: string | null;
  onOpenChange: (open: boolean) => void;
};

/** Detalhe da decisão em painel lateral: o que entendeu, que ação tomou, segurança e por quê. */
export function DecisionPanel({ messageId, onOpenChange }: DecisionPanelProps) {
  const trace = useQuery({
    queryKey: ['decision-trace', messageId],
    queryFn: () => getDecisionTrace(messageId ?? ''),
    enabled: !!messageId,
    staleTime: Number.POSITIVE_INFINITY,
  });

  return (
    <Sheet open={!!messageId} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Como o Nexo Assist decidiu</SheetTitle>
          <SheetDescription>
            O que entendeu, a ação tomada, com que segurança e por quê.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6">
          {trace.isPending && (
            <div className="space-y-4" aria-busy="true">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {trace.isError && (
            <div
              role="alert"
              className="space-y-3 rounded-lg bg-danger-soft p-4 text-sm text-danger"
            >
              <p>{trace.error.message}</p>
              <Button variant="outline" size="sm" onClick={() => trace.refetch()}>
                Tentar novamente
              </Button>
            </div>
          )}

          {trace.data && <TraceBody trace={trace.data} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
