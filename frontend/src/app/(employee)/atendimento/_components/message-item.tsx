'use client';

import type {
  MessageBlock,
  MessageDto,
  TicketDraftDto,
  TicketSummaryDto,
  TraceStep,
} from '@nexo/shared';
import { AlertTriangle, Info } from 'lucide-react';

import { AgentActionTrail } from '@/components/conversation/agent-action-trail';
import { TicketCard } from '@/components/conversation/ticket-card';
import { cn, formatTime } from '@/lib/utils';
import { QuickReplies } from './quick-replies';
import { TicketDraftCard } from './ticket-draft-card';
import { TicketSelectList } from './ticket-select-list';

export type BlockHandlers = {
  conversationId: string;
  drafts: TicketDraftDto[];
  /** Respostas por opção/seleção só valem na última mensagem do agent, com o agent ativo. */
  interactive: boolean;
  onQuickReply: (option: string) => void;
  onPickTicket: (ticket: TicketSummaryDto) => void;
};

function Blocks({ blocks, handlers }: { blocks: MessageBlock[]; handlers: BlockHandlers }) {
  if (blocks.length === 0) return null;

  return (
    <div className="mt-3 space-y-3">
      {blocks.map((block) => {
        switch (block.type) {
          case 'TICKET_CARD':
            return <TicketCard key={`card-${block.ticket.id}`} ticket={block.ticket} />;
          case 'TICKET_PICKER':
            return (
              <TicketSelectList
                key="picker"
                tickets={block.tickets}
                selectedId={block.selectedId}
                disabled={!handlers.interactive}
                onSelect={handlers.onPickTicket}
              />
            );
          case 'DRAFT': {
            const draft = handlers.drafts.find((item) => item.id === block.draftId);
            return draft ? (
              <TicketDraftCard
                key={draft.id}
                conversationId={handlers.conversationId}
                draft={draft}
                disabled={false}
              />
            ) : null;
          }
          case 'QUICK_REPLIES':
            return (
              <QuickReplies
                key="quick"
                question={block.question}
                options={block.options}
                answered={block.answered}
                disabled={!handlers.interactive}
                onSelect={handlers.onQuickReply}
              />
            );
          case 'NOTICE':
            return (
              <p
                key={`notice-${block.text}`}
                className={cn(
                  'flex items-start gap-2 rounded-lg px-3 py-2 text-sm',
                  block.tone === 'error'
                    ? 'bg-danger-soft text-danger'
                    : block.tone === 'warning'
                      ? 'bg-warning-soft text-warning'
                      : 'bg-info-soft text-info',
                )}
              >
                {block.tone === 'info' ? (
                  <Info className="mt-0.5 size-4 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                )}
                {block.text}
              </p>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

type AgentReplyProps = {
  text: string;
  blocks: MessageBlock[];
  steps: Pick<TraceStep, 'id' | 'label' | 'status' | 'attempts'>[];
  confidence?: { score: number; band: 'HIGH' | 'MEDIUM' | 'LOW' };
  createdAt?: string;
  streaming?: boolean;
  onOpenDetails?: () => void;
  handlers: BlockHandlers;
};

export function AgentReply({
  text,
  blocks,
  steps,
  confidence,
  createdAt,
  streaming,
  onOpenDetails,
  handlers,
}: AgentReplyProps) {
  const isWide = (block: MessageBlock) =>
    block.type === 'TICKET_CARD' || block.type === 'DRAFT' || block.type === 'TICKET_PICKER';
  const wide = blocks.filter(isWide);
  const inline = blocks.filter((block) => !isWide(block));

  return (
    <div className="max-w-[92%] space-y-2 sm:max-w-[85%]">
      <AgentActionTrail steps={steps} confidence={confidence} onOpenDetails={onOpenDetails} />

      {(text || inline.length > 0 || streaming) && (
        <div className="rounded-xl border bg-card px-4 py-3 text-[15px] leading-relaxed">
          {text ? (
            <p className="whitespace-pre-line">{text}</p>
          ) : (
            streaming && (
              <span className="inline-flex gap-1 py-2">
                <span className="sr-only">Nexo Assist está escrevendo</span>
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    aria-hidden="true"
                    className="size-1.5 animate-pulse rounded-full bg-muted-foreground motion-reduce:animate-none"
                    style={{ animationDelay: `${dot * 150}ms` }}
                  />
                ))}
              </span>
            )
          )}
          <Blocks blocks={inline} handlers={handlers} />
        </div>
      )}

      {wide.length > 0 && <Blocks blocks={wide} handlers={handlers} />}

      {createdAt && (
        <p className="text-[11px] text-muted-foreground tabular-nums">{formatTime(createdAt)}</p>
      )}
    </div>
  );
}

type MessageItemProps = {
  message: MessageDto;
  handlers: BlockHandlers;
  onOpenDetails: (messageId: string) => void;
};

export function MessageItem({ message, handlers, onOpenDetails }: MessageItemProps) {
  switch (message.author) {
    case 'EMPLOYEE':
      return (
        <div className="flex flex-col items-end gap-1">
          <p className="max-w-[85%] rounded-xl bg-navy px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-line text-navy-foreground">
            {message.text}
          </p>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {formatTime(message.createdAt)}
          </span>
        </div>
      );

    case 'AGENT':
      return (
        <AgentReply
          text={message.text}
          blocks={message.blocks}
          steps={message.trace?.steps ?? []}
          confidence={message.trace?.confidence}
          createdAt={message.createdAt}
          onOpenDetails={message.trace ? () => onOpenDetails(message.id) : undefined}
          handlers={handlers}
        />
      );

    case 'ANALYST':
      return (
        <div className="max-w-[85%] space-y-1">
          <p className="text-xs font-semibold text-success">{message.authorName} · Analista</p>
          <p className="rounded-xl border border-emerald-100 bg-success-soft px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-line">
            {message.text}
          </p>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {formatTime(message.createdAt)}
          </span>
        </div>
      );

    case 'SYSTEM':
      return (
        <p className="flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
          <span className="text-center">{message.text}</span>
        </p>
      );
  }
}
