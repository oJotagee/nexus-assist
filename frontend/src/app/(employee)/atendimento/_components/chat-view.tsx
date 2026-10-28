'use client';

import type { ConversationDto, TicketSummaryDto } from '@nexo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Clock, Headset, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { DecisionPanel } from '@/components/conversation/decision-panel';
import { StatusDot } from '@/components/conversation/status';
import { Button } from '@/components/ui/button';
import { EmployeeTopbar } from '../../_components/employee-topbar';
import { startNewSession } from '../_actions/start-new-session';
import { getActiveConversation } from '../_data-access/get-active-conversation';
import { CONVERSATION_QUERY_KEY, type SendInput, useAgentStream } from '../_hooks/use-agent-stream';
import { Composer } from './composer';
import { AgentReply, type BlockHandlers, MessageItem } from './message-item';

const POLLING_WITH_ANALYST_MS = 4000;

const SUGGESTIONS = [
  'Qual o status do meu chamado?',
  'Minha VPN não conecta, aparece o erro 809.',
  'Qual o horário do service desk?',
];

export function ChatView({
  initialConversation,
  firstName,
}: {
  initialConversation: ConversationDto;
  firstName: string;
}) {
  const queryClient = useQueryClient();
  const [traceMessageId, setTraceMessageId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversation } = useQuery({
    queryKey: CONVERSATION_QUERY_KEY,
    queryFn: getActiveConversation,
    initialData: initialConversation,
    // Com analista (ou esperando um), busca as mensagens dele periodicamente.
    refetchInterval: (query) =>
      query.state.data && query.state.data.state !== 'AGENT' && query.state.data.state !== 'CLOSED'
        ? POLLING_WITH_ANALYST_MS
        : false,
    refetchIntervalInBackground: false,
  });

  const stream = useAgentStream(conversation.id);

  const newSession = useMutation({
    mutationFn: () => startNewSession(conversation.id),
    onSuccess: (result) => {
      if (result.error || !result.data) return toast.error(result.error ?? 'Algo deu errado.');
      queryClient.setQueryData(CONVERSATION_QUERY_KEY, result.data);
      stream.clearError();
    },
  });

  const lastAgentMessageId = useMemo(
    () => [...conversation.messages].reverse().find((message) => message.author === 'AGENT')?.id,
    [conversation.messages],
  );

  const agentActive = conversation.state === 'AGENT' || conversation.state === 'CLOSED';
  const limitReached =
    conversation.session.messageCount + (agentActive ? 2 : 1) > conversation.session.limit;

  async function send(input: SendInput) {
    const ok = await stream.send(input);
    return ok;
  }

  function handlersFor(messageId: string | null): BlockHandlers {
    return {
      conversationId: conversation.id,
      drafts: conversation.drafts,
      interactive:
        agentActive && !stream.isStreaming && !limitReached && messageId === lastAgentMessageId,
      onQuickReply: (option) =>
        messageId &&
        void send({ text: option, reply: { messageId, kind: 'QUICK_REPLY', value: option } }),
      onPickTicket: (ticket: TicketSummaryDto) =>
        messageId &&
        void send({
          text: `${ticket.id} - ${ticket.title}`,
          reply: { messageId, kind: 'TICKET_PICKER', value: ticket.id },
        }),
    };
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: as dependências são os gatilhos de rolagem (nova mensagem, texto chegando), não valores lidos no efeito.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [
    conversation.messages.length,
    stream.live?.text,
    stream.live?.steps.length,
    stream.live?.blocks.length,
    stream.pendingText,
  ]);

  const statusBadge =
    conversation.state === 'WITH_ANALYST' ? (
      <StatusDot tone="success" pill>
        Com {conversation.assignedAnalyst?.name.split(' ')[0] ?? 'um analista'}
      </StatusDot>
    ) : conversation.state === 'WAITING_ANALYST' ? (
      <StatusDot tone="warning" pill>
        Aguardando atendente
      </StatusDot>
    ) : (
      <StatusDot tone="success" pill>
        Assistente online
      </StatusDot>
    );

  const isEmpty = conversation.messages.length === 0 && !stream.pendingText;

  return (
    <>
      <EmployeeTopbar title="Atendimento" status={statusBadge} />

      <main className="flex-1 overflow-y-auto" id="conteudo">
        <div
          role="log"
          aria-live="polite"
          aria-label="Conversa com o Nexo Assist"
          className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6"
        >
          {isEmpty && (
            <section className="mt-6 text-center sm:mt-16">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-primary">
                <Sparkles className="size-5" />
              </span>
              <h1 className="mt-4 font-serif text-3xl">Olá, {firstName}. Como posso ajudar?</h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Conte o que está acontecendo com suas palavras. Eu consulto seus chamados, busco na
                central de ajuda e chamo um analista quando precisa.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void send({ text: suggestion })}
                    className="rounded-lg border bg-white px-3 py-2 text-sm hover:border-primary/40 hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </section>
          )}

          {conversation.messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              handlers={handlersFor(message.author === 'AGENT' ? message.id : null)}
              onOpenDetails={setTraceMessageId}
            />
          ))}

          {stream.pendingText && (
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-xl bg-navy/80 px-4 py-2.5 text-[15px] whitespace-pre-line text-navy-foreground">
                {stream.pendingText}
              </p>
            </div>
          )}

          {stream.live && agentActive && (
            <AgentReply
              text={stream.live.text}
              blocks={stream.live.blocks}
              steps={stream.live.steps}
              streaming
              handlers={{ ...handlersFor(null), interactive: false }}
            />
          )}

          {stream.error && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-danger-soft px-4 py-3 text-sm text-danger"
            >
              <AlertCircle className="size-4 shrink-0" />
              <span className="flex-1">{stream.error.message}</span>
              {stream.error.failedText && stream.error.code !== 'SessionLimitReachedError' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const text = stream.error?.failedText;
                    if (text) void send({ text });
                  }}
                >
                  <RefreshCw /> Tentar novamente
                </Button>
              )}
            </div>
          )}

          {conversation.state === 'WAITING_ANALYST' && (
            <p className="flex items-center gap-2 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">
              <Clock className="size-4 shrink-0" />
              Sua conversa está na fila do Suporte {conversation.handoffGroup ?? 'N1'}. Pode
              continuar escrevendo: o analista verá tudo quando assumir.
            </p>
          )}

          {conversation.state === 'WITH_ANALYST' && (
            <p className="flex items-center gap-2 rounded-lg bg-success-soft px-4 py-3 text-sm text-success">
              <Headset className="size-4 shrink-0" />
              Você está falando com {conversation.assignedAnalyst?.name}
              {conversation.assignedAnalyst?.supportLevel &&
                ` · Suporte ${conversation.assignedAnalyst.supportLevel}`}
              .
            </p>
          )}

          {limitReached && (
            <div className="rounded-lg border bg-white px-4 py-4 text-center">
              <p className="text-sm font-medium">
                Esta sessão chegou ao limite de {conversation.session.limit} mensagens.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Comece uma nova sessão: o assistente continua com o contexto desta conversa.
              </p>
              <Button
                className="mt-3"
                onClick={() => newSession.mutate()}
                disabled={newSession.isPending}
              >
                {newSession.isPending && <Loader2 className="animate-spin" />}
                Iniciar nova sessão
              </Button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      <Composer
        disabled={limitReached}
        busy={stream.isStreaming}
        placeholder={
          conversation.state === 'WITH_ANALYST'
            ? `Escreva para ${conversation.assignedAnalyst?.name.split(' ')[0] ?? 'o analista'}…`
            : 'Escreva para o Nexo…'
        }
        messageCount={conversation.session.messageCount}
        limit={conversation.session.limit}
        restoreText={stream.error?.failedText ?? null}
        onSend={(text) => send({ text })}
      />

      <DecisionPanel
        messageId={traceMessageId}
        onOpenChange={(open) => !open && setTraceMessageId(null)}
      />
    </>
  );
}
