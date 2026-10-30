'use client';

import { type ConsoleConversationDto, HANDOFF_REASON_LABEL } from '@nexo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  ArrowLeft,
  Bot,
  ClipboardList,
  FileText,
  Headset,
  Loader2,
  LogOut,
  Send,
  Undo2,
} from 'lucide-react';

import { DecisionPanel } from '@/components/conversation/decision-panel';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { getConsoleConversation } from '../../_data-access/console';
import { EmployeeTicketsPanel } from './employee-tickets-panel';
import { cn, formatRelative, getInitials } from '@/lib/utils';
import { StatusDot } from '@/components/conversation/status';
import { ConsoleMessage } from './console-message';
import { type CloseConversationChoice, CloseConversationDialog } from './close-conversation-dialog';
import { Button } from '@/components/ui/button';
import {
  type ConsoleActionResult,
  changeConversationState,
  sendAnalystMessage,
} from '../../_actions/conversation-actions';

type Props = { initialConversation: ConsoleConversationDto; analystId: string };

export function ConsoleConversationView({ initialConversation, analystId }: Props) {
  const queryClient = useQueryClient();
  const queryKey = ['console', 'conversation', initialConversation.id];
  const [traceMessageId, setTraceMessageId] = useState<string | null>(null);
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversation } = useQuery({
    queryKey,
    queryFn: () => getConsoleConversation(initialConversation.id),
    initialData: initialConversation,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  function apply(result: ConsoleActionResult, success?: string) {
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Algo deu errado.');
      void queryClient.invalidateQueries({ queryKey });
      return false;
    }
    queryClient.setQueryData(queryKey, result.data);
    void queryClient.invalidateQueries({ queryKey: ['console', 'list'] });
    if (success) toast.success(success);
    return true;
  }

  const transition = useMutation({
    mutationFn: (action: 'assume' | 'release') =>
      changeConversationState({ conversationId: conversation.id, action }),
    onSuccess: (result, action) =>
      apply(
        result,
        {
          assume: 'Atendimento assumido. O agent está pausado.',
          release: 'Conversa devolvida ao agent.',
        }[action],
      ),
  });

  const close = useMutation({
    mutationFn: (choice: CloseConversationChoice) =>
      changeConversationState({ conversationId: conversation.id, action: 'close', ...choice }),
    onSuccess: (result, choice) => {
      const ticketId = conversation.focusTicketId;
      const closed = apply(
        result,
        choice.resolveTicket && ticketId
          ? `Atendimento encerrado e ${ticketId} resolvido.`
          : 'Atendimento encerrado.',
      );
      if (closed) setCloseOpen(false);
    },
  });

  const send = useMutation({
    mutationFn: (text: string) => sendAnalystMessage({ conversationId: conversation.id, text }),
    onSuccess: (result, text) => {
      if (!apply(result)) setDraft(text);
    },
  });

  const lastMessageId = conversation.messages.at(-1)?.id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: rola quando chega mensagem nova.
  useEffect(() => {
    const log = scrollRef.current;
    log?.scrollTo({ top: log.scrollHeight });
  }, [lastMessageId]);

  const firstName = conversation.employee.name.split(' ')[0];
  const mine =
    conversation.state === 'WITH_ANALYST' && conversation.assignedAnalyst?.id === analystId;
  const busy = transition.isPending || close.isPending;
  const pendingAction = close.isPending
    ? 'close'
    : transition.isPending
      ? transition.variables
      : null;

  function submit() {
    const text = draft.trim();
    if (!text || send.isPending) return;
    setDraft('');
    send.mutate(text);
  }

  const stateBadge = {
    WAITING_ANALYST: (
      <StatusDot tone="warning" pill>
        Aguardando atendente
      </StatusDot>
    ),
    WITH_ANALYST: (
      <StatusDot tone="success" pill>
        Em atendimento
      </StatusDot>
    ),
    AGENT: (
      <StatusDot tone="info" pill>
        Agent atendendo
      </StatusDot>
    ),
    CLOSED: (
      <StatusDot tone="neutral" pill>
        Encerrada
      </StatusDot>
    ),
  }[conversation.state];

  return (
    <div className="flex h-full min-w-0 flex-1">
      <section
        className="flex min-w-0 flex-1 flex-col"
        aria-label={`Conversa com ${conversation.employee.name}`}
      >
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-white px-4">
          <Link
            href="/console"
            className="grid size-8 place-items-center rounded-md hover:bg-muted lg:hidden"
            aria-label="Voltar para a lista"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
            {getInitials(conversation.employee.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold">{conversation.employee.name}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {conversation.employee.department}
              {conversation.focusTicketId && ` · ${conversation.focusTicketId}`}
            </p>
          </div>
          <span className="hidden md:inline-flex">{stateBadge}</span>

          {mine && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => transition.mutate('release')}
                disabled={busy}
              >
                {pendingAction === 'release' ? <Loader2 className="animate-spin" /> : <Undo2 />}
                <span className="hidden sm:inline">Devolver ao agent</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-red-200 text-danger hover:bg-danger-soft hover:text-danger"
                onClick={() => setCloseOpen(true)}
                disabled={busy}
              >
                {pendingAction === 'close' ? <Loader2 className="animate-spin" /> : <LogOut />}
                <span className="hidden sm:inline">Encerrar atendimento</span>
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            className="xl:hidden"
            aria-label={`Chamados de ${firstName}`}
            onClick={() => setTicketsOpen(true)}
          >
            <ClipboardList />
          </Button>
        </header>

        <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto bg-background">
          <div
            role="log"
            aria-label="Histórico da conversa"
            className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6"
          >
            {conversation.handoffSummary && conversation.state !== 'AGENT' && (
              <section className="rounded-xl border border-amber-200 bg-warning-soft/60 p-4">
                <h2 className="flex items-center gap-2 text-xs font-semibold text-warning">
                  <FileText className="size-3.5" />
                  Resumo da transferência
                  {conversation.handoffReason && (
                    <span className="font-normal">
                      · {HANDOFF_REASON_LABEL[conversation.handoffReason]}
                    </span>
                  )}
                  {conversation.handoffGroup && (
                    <span className="font-normal">· Suporte {conversation.handoffGroup}</span>
                  )}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed">{conversation.handoffSummary}</p>
              </section>
            )}

            {conversation.messages.map((message) => (
              <ConsoleMessage
                key={message.id}
                message={message}
                drafts={conversation.drafts}
                onOpenDetails={setTraceMessageId}
              />
            ))}
          </div>
        </div>

        {conversation.state === 'WAITING_ANALYST' && (
          <footer className="flex flex-wrap items-center gap-3 border-t bg-white px-4 py-3">
            <span className="grid size-9 place-items-center rounded-full bg-warning-soft text-warning">
              <Headset className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{firstName} espera um atendente</p>
              <p className="text-xs text-muted-foreground">
                Agent pausado
                {conversation.handoffAt && ` · em fila ${formatRelative(conversation.handoffAt)}`}
              </p>
            </div>
            <Button variant="outline" onClick={() => transition.mutate('release')} disabled={busy}>
              {pendingAction === 'release' ? <Loader2 className="animate-spin" /> : <Bot />}
              Devolver ao agent
            </Button>
            <Button onClick={() => transition.mutate('assume')} disabled={busy}>
              {pendingAction === 'assume' ? <Loader2 className="animate-spin" /> : <Headset />}
              Assumir atendimento
            </Button>
          </footer>
        )}

        {(conversation.state === 'AGENT' || conversation.state === 'CLOSED') && (
          <footer className="flex flex-wrap items-center gap-3 border-t bg-white px-4 py-3 text-sm">
            <p className="flex-1 text-muted-foreground">
              {conversation.state === 'AGENT'
                ? 'O Nexo Assist está atendendo esta conversa.'
                : 'Atendimento encerrado. Se o funcionário escrever, o agent retoma.'}
            </p>
            {conversation.state === 'AGENT' && (
              <Button variant="outline" onClick={() => transition.mutate('assume')} disabled={busy}>
                {pendingAction === 'assume' ? <Loader2 className="animate-spin" /> : <Headset />}
                Assumir mesmo assim
              </Button>
            )}
          </footer>
        )}

        {conversation.state === 'WITH_ANALYST' && (
          <footer className="border-t bg-white px-4 py-3">
            {mine ? (
              <form
                className="flex items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  submit();
                }}
              >
                <label htmlFor="analyst-composer" className="sr-only">
                  Mensagem para {firstName}
                </label>
                <textarea
                  id="analyst-composer"
                  rows={1}
                  value={draft}
                  maxLength={2000}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      submit();
                    }
                  }}
                  placeholder={`Responda para ${firstName}…`}
                  className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
                />
                <Button
                  type="submit"
                  size="icon"
                  aria-label="Enviar"
                  disabled={!draft.trim() || send.isPending}
                  className="size-10 rounded-full"
                >
                  {send.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                </Button>
              </form>
            ) : (
              <p className={cn('text-sm text-muted-foreground')}>
                {conversation.assignedAnalyst?.name} está atendendo esta conversa.
              </p>
            )}
          </footer>
        )}
      </section>

      <EmployeeTicketsPanel conversation={conversation} className="hidden xl:flex" />

      <Sheet open={ticketsOpen} onOpenChange={setTicketsOpen}>
        <SheetContent side="right" showCloseButton={false} className="w-80 p-0 xl:hidden">
          <SheetTitle className="sr-only">Chamados de {firstName}</SheetTitle>
          <EmployeeTicketsPanel
            conversation={conversation}
            onClose={() => setTicketsOpen(false)}
            className="flex h-full w-full border-l-0"
          />
        </SheetContent>
      </Sheet>

      <CloseConversationDialog
        key={`${conversation.id}-${closeOpen}`}
        open={closeOpen}
        onOpenChange={setCloseOpen}
        ticketId={conversation.focusTicketId}
        employeeFirstName={firstName}
        pending={close.isPending}
        onConfirm={(choice) => close.mutate(choice)}
      />

      <DecisionPanel
        messageId={traceMessageId}
        onOpenChange={(open) => !open && setTraceMessageId(null)}
      />
    </div>
  );
}
