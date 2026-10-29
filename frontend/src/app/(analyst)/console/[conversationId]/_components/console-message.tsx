'use client';

import {
  TICKET_CATEGORY_LABEL,
  TICKET_PRIORITY_LABEL,
  type MessageBlock,
  type MessageDto,
  type TicketDraftDto,
} from '@nexo/shared';
import { AlertTriangle, ArrowRight, Check } from 'lucide-react';

import { AgentActionTrail } from '@/components/conversation/agent-action-trail';
import { visibleReplyText } from '@/components/conversation/reply-text';
import { StatusDot, TicketStatusBadge } from '@/components/conversation/status';
import { cn, formatTime } from '@/lib/utils';

const DRAFT_STATUS = {
  PENDING: { tone: 'warning', label: 'Aguardando confirmação' },
  CONFIRMED: { tone: 'success', label: 'Confirmado' },
  CANCELLED: { tone: 'neutral', label: 'Descartado' },
} as const;

/** Blocos em modo leitura: o analista vê o que o funcionário viu, sem poder agir por ele. */
function ReadOnlyBlock({ block, drafts }: { block: MessageBlock; drafts: TicketDraftDto[] }) {
  switch (block.type) {
    case 'TICKET_CARD':
      return (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2 text-xs">
          <span className="min-w-0 truncate">
            <span className="font-semibold tabular-nums">{block.ticket.id}</span> ·{' '}
            {block.ticket.title}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {block.ticket.overdue && <span className="font-medium text-danger">vencido</span>}
            <TicketStatusBadge status={block.ticket.status} />
          </span>
        </div>
      );
    case 'TICKET_PICKER':
      return (
        <ul className="divide-y rounded-lg border bg-white text-xs">
          {block.tickets.map((ticket) => (
            <li
              key={ticket.id}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5',
                ticket.id === block.selectedId && 'bg-accent/60 font-medium',
              )}
            >
              {ticket.id === block.selectedId ? (
                <Check className="size-3 text-primary" />
              ) : (
                <span className="size-3" />
              )}
              <span className="tabular-nums">{ticket.id}</span>
              <span className="truncate text-muted-foreground">{ticket.title}</span>
            </li>
          ))}
        </ul>
      );
    case 'QUICK_REPLIES':
      return (
        <div className="space-y-1.5 text-xs">
          <p className="font-medium">{block.question}</p>
          <div className="flex flex-wrap gap-1.5">
            {block.options.map((option) => (
              <span
                key={option}
                className={cn(
                  'rounded-md border px-2 py-0.5',
                  option === block.answered
                    ? 'border-primary bg-accent font-medium text-accent-foreground'
                    : 'bg-white text-muted-foreground',
                )}
              >
                {option}
              </span>
            ))}
          </div>
        </div>
      );
    case 'DRAFT': {
      const draft = drafts.find((item) => item.id === block.draftId);
      if (!draft) return null;
      const status = DRAFT_STATUS[draft.status];
      return (
        <div className="space-y-1 rounded-lg border bg-white px-3 py-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">
              Rascunho{' '}
              {draft.mode === 'CREATE'
                ? 'de chamado'
                : `de ${draft.mode === 'UPDATE' ? 'atualização' : 'reabertura'} · ${draft.targetTicketId}`}
              {draft.resultTicketId && (
                <>
                  <ArrowRight className="mx-1 inline size-3" aria-label="virou" />
                  {draft.resultTicketId}
                </>
              )}
            </span>
            <StatusDot tone={status.tone}>{status.label}</StatusDot>
          </div>
          <p className="font-semibold">{draft.title}</p>
          <p className="text-muted-foreground">
            {TICKET_CATEGORY_LABEL[draft.category]} · prioridade{' '}
            {TICKET_PRIORITY_LABEL[draft.priority].toLowerCase()} · {draft.priorityRule}
          </p>
        </div>
      );
    }
    case 'NOTICE':
      return (
        <p className="flex items-start gap-1.5 rounded-md bg-warning-soft px-2.5 py-1.5 text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {block.text}
        </p>
      );
    default:
      return null;
  }
}

type ConsoleMessageProps = {
  message: MessageDto;
  drafts: TicketDraftDto[];
  onOpenDetails: (messageId: string) => void;
};

export function ConsoleMessage({ message, drafts, onOpenDetails }: ConsoleMessageProps) {
  const time = (
    <span className="text-[11px] text-muted-foreground tabular-nums">
      {formatTime(message.createdAt)}
    </span>
  );

  switch (message.author) {
    case 'EMPLOYEE':
      return (
        <div className="flex max-w-[80%] flex-col items-start gap-1">
          <p className="rounded-xl rounded-tl-sm border bg-white px-3.5 py-2 text-sm leading-relaxed whitespace-pre-line">
            {message.text}
          </p>
          {time}
        </div>
      );

    case 'AGENT':
      return (
        <div className="ml-auto flex max-w-[80%] flex-col items-end gap-1">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            Nexo Assist
            <span className="rounded bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
              IA
            </span>
          </p>
          <div className="w-full space-y-2 rounded-xl rounded-tr-sm border border-blue-100 bg-info-soft/70 px-3.5 py-2.5 text-sm leading-relaxed">
            {visibleReplyText(message.text, message.blocks) && (
              <p className="whitespace-pre-line">
                {visibleReplyText(message.text, message.blocks)}
              </p>
            )}
            {message.blocks.map((block, index) => (
              <ReadOnlyBlock key={`${block.type}-${index}`} block={block} drafts={drafts} />
            ))}
          </div>
          {message.trace && (
            <AgentActionTrail
              steps={message.trace.steps}
              confidence={message.trace.confidence}
              onOpenDetails={() => onOpenDetails(message.id)}
            />
          )}
          {time}
        </div>
      );

    case 'ANALYST':
      return (
        <div className="ml-auto flex max-w-[80%] flex-col items-end gap-1">
          <p className="text-xs font-medium text-success">{message.authorName}</p>
          <p className="rounded-xl rounded-tr-sm border border-emerald-100 bg-success-soft px-3.5 py-2 text-sm leading-relaxed whitespace-pre-line">
            {message.text}
          </p>
          {time}
        </div>
      );

    case 'SYSTEM':
      return (
        <p className="flex items-center gap-3 text-[11px] text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
          {message.text}
        </p>
      );
  }
}
