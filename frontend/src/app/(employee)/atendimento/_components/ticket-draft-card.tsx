'use client';

import { CheckCircle2, CornerDownLeft, Loader2, RotateCw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  type ConversationDto,
  TICKET_CATEGORY_LABEL,
  TICKET_IMPACT_LABEL,
  type TicketDraftDto,
  formatDueAt,
} from '@nexo/shared';

import { PriorityLabel, StatusDot } from '@/components/conversation/status';
import { CONVERSATION_QUERY_KEY } from '../_hooks/use-agent-stream';
import { Detail } from '@/components/conversation/ticket-card';
import { DraftEditDialog } from './draft-edit-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  type ConversationActionResult,
  cancelDraft,
  confirmDraft,
} from '../_actions/draft-actions';

const HEADER: Record<TicketDraftDto['mode'], string> = {
  CREATE: 'Novo chamado',
  UPDATE: 'Atualizar chamado',
  REOPEN: 'Reabrir chamado',
};

type TicketDraftCardProps = {
  conversationId: string;
  draft: TicketDraftDto;
  /** O funcionário só age sobre o rascunho enquanto a conversa permite (ex.: não durante o stream). */
  disabled: boolean;
};

/**
 * Rascunho para confirmação (Tela 2). Nada é gravado no sistema de chamados antes do
 * "Confirmar"; o botão manda a mesma chave de idempotência em toda tentativa.
 */
export function TicketDraftCard({ conversationId, draft, disabled }: TicketDraftCardProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [unstable, setUnstable] = useState(false);
  const ref = { conversationId, draftId: draft.id };

  function onResult(result: ConversationActionResult, success?: string) {
    if (result.error || !result.data) {
      setUnstable(result.code === 'TicketsUnavailableError');
      if (result.code !== 'TicketsUnavailableError')
        toast.error(result.error ?? 'Algo deu errado.');
      return;
    }
    setUnstable(false);
    queryClient.setQueryData<ConversationDto>(CONVERSATION_QUERY_KEY, result.data);
    if (success) toast.success(success);
  }

  const confirm = useMutation({
    mutationFn: () => confirmDraft(ref),
    onSuccess: (result) => onResult(result),
  });
  const cancel = useMutation({
    mutationFn: () => cancelDraft(ref),
    onSuccess: (result) => onResult(result),
  });

  const pending = draft.status === 'PENDING';
  const busy = confirm.isPending || cancel.isPending;
  const due = formatDueAt(new Date(draft.dueAt), new Date());

  return (
    <article
      aria-label={`${HEADER[draft.mode]}, rascunho`}
      className={cn('rounded-xl border bg-card p-4 shadow-sm sm:p-5', !pending && 'shadow-none')}
      onKeyDown={(event) => {
        if (
          event.key === 'Enter' &&
          (event.metaKey || event.ctrlKey) &&
          pending &&
          !busy &&
          !disabled
        ) {
          confirm.mutate();
        }
      }}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {HEADER[draft.mode]}
          {draft.targetTicketId && (
            <span className="font-medium tabular-nums"> {draft.targetTicketId}</span>
          )}
          {' · '}
          {draft.status === 'CONFIRMED' ? (
            <span className="font-medium tabular-nums">{draft.resultTicketId}</span>
          ) : (
            'Rascunho'
          )}
        </p>
        {draft.status === 'PENDING' && <StatusDot tone="warning">Aguardando confirmação</StatusDot>}
        {draft.status === 'CONFIRMED' && <StatusDot tone="success">Confirmado</StatusDot>}
        {draft.status === 'CANCELLED' && <StatusDot tone="neutral">Descartado</StatusDot>}
      </header>

      <h3
        className={cn(
          'mt-2 text-lg leading-snug font-semibold',
          draft.status === 'CANCELLED' && 'text-muted-foreground line-through',
        )}
      >
        {draft.title}
      </h3>
      <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{draft.description}</p>

      <dl className="mt-4 grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-3">
        <Detail label="Categoria">{TICKET_CATEGORY_LABEL[draft.category]}</Detail>
        <Detail label="Prioridade">
          <PriorityLabel priority={draft.priority} suffix={`resposta até ${due}`} />
          <span
            className="mt-0.5 block text-xs font-normal text-muted-foreground"
            title={draft.priorityRule}
          >
            {draft.priorityRule}
          </span>
        </Detail>
        <Detail label="Afetados">{TICKET_IMPACT_LABEL[draft.impact]}</Detail>
      </dl>

      {pending && (
        <footer className="mt-4 space-y-3 border-t pt-4">
          {unstable && (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning"
            >
              <RotateCw className="size-4 shrink-0" />O sistema de chamados está instável agora. O
              rascunho foi mantido; tente de novo.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => confirm.mutate()} disabled={busy || disabled}>
              {confirm.isPending ? (
                <Loader2 className="animate-spin" />
              ) : unstable ? (
                <RotateCw />
              ) : (
                <CheckCircle2 />
              )}
              {unstable ? 'Tentar de novo' : 'Confirmar'}
              {!confirm.isPending && (
                <kbd className="ml-1 hidden items-center gap-0.5 rounded bg-white/20 px-1 text-[10px] sm:inline-flex">
                  Ctrl <CornerDownLeft className="size-2.5" />
                </kbd>
              )}
            </Button>
            <Button variant="outline" onClick={() => setEditing(true)} disabled={busy || disabled}>
              Editar
            </Button>
            <Button variant="ghost" onClick={() => cancel.mutate()} disabled={busy || disabled}>
              {cancel.isPending && <Loader2 className="animate-spin" />}
              Cancelar
            </Button>
          </div>
        </footer>
      )}

      <DraftEditDialog
        open={editing}
        onOpenChange={setEditing}
        conversationId={conversationId}
        draft={draft}
        onSaved={(result) => onResult(result, 'Rascunho atualizado.')}
      />
    </article>
  );
}
