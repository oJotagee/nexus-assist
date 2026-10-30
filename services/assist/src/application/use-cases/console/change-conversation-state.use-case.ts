import type { ConsoleConversationDto, TraceStep } from '@nexo/shared';
import { Inject, Injectable } from '@nestjs/common';

import { GetConsoleConversationUseCase } from './get-console-conversation.use-case';
import { TICKETS_GATEWAY, type TicketsGateway } from '../../ports/tickets-gateway.port';
import type { ConversationEntity } from '@/domain/entities/conversation.entity';
import type { EmployeeRecord } from '@/domain/entities/message';
import { followUpQuestion } from '@/domain/policies/follow-up';
import { CLOCK, type Clock } from '../../ports/services.port';
import { toTicketSummary } from '../../presenters';
import {
  ConversationNotFoundError,
  EmployeeNotFoundError,
  TicketConflictError,
} from '@/domain/errors/domain.error';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
  EMPLOYEE_REPOSITORY,
  type EmployeeRepository,
  MESSAGE_REPOSITORY,
  type MessageRepository,
} from '../../ports/repositories.port';

export type ConversationAction = 'assume' | 'release' | 'close';

type ChangeStateInput = {
  conversationId: string;
  analystId: string;
  action: ConversationAction;
  /** Ao encerrar: resolve também o chamado em foco, com a solução no histórico dele. */
  resolveTicket?: boolean;
  resolution?: string;
};

type ResolvedTicket = Awaited<ReturnType<TicketsGateway['close']>> & { durationMs: number };

const TIME = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Assumir (agent pausa), devolver ao agent ou encerrar. Cada transição deixa um marcador
 * de sistema na conversa, visível para o funcionário e no console. Ao encerrar, o analista pode
 * resolver o chamado em foco; se o sistema de chamados falhar, nada é gravado e ele tenta de novo.
 */
@Injectable()
export class ChangeConversationStateUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepository,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(TICKETS_GATEWAY) private readonly tickets: TicketsGateway,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly getConversation: GetConsoleConversationUseCase,
  ) {}

  async execute({
    conversationId,
    analystId,
    action,
    resolveTicket = false,
    resolution,
  }: ChangeStateInput): Promise<ConsoleConversationDto> {
    const [conversation, analyst] = await Promise.all([
      this.conversations.findById(conversationId),
      this.employees.findById(analystId),
    ]);
    if (!conversation) throw new ConversationNotFoundError();
    if (!analyst) throw new EmployeeNotFoundError();

    const now = this.clock.now();
    const next = this.transition(conversation, action, analystId, now);
    const level = analyst.supportLevel ? ` (Suporte ${analyst.supportLevel})` : '';
    const at = TIME.format(now);

    const ticketId = conversation.focusTicketId;
    const resolved =
      action === 'close' && resolveTicket && ticketId
        ? await this.resolveTicket(conversation.employeeId, ticketId, analyst, resolution)
        : null;

    const text = {
      assume: `${analyst.name}${level} assumiu o atendimento · agent pausado · ${at}`,
      release: `${analyst.name} devolveu a conversa ao Nexo Assist · ${at}`,
      close: `${analyst.name} encerrou o atendimento · ${at}`,
    }[action];

    await this.conversations.save(next);
    await this.messages.append({
      conversationId,
      author: 'SYSTEM',
      authorId: analystId,
      authorName: analyst.name,
      text,
      blocks: [],
    });

    if (action === 'release') await this.askFollowUp(next, analyst.name);
    if (resolved && ticketId) {
      await this.announceResolution(conversationId, ticketId, analyst, resolution, resolved);
    }

    return this.getConversation.execute(conversationId);
  }

  /** Chamado já encerrado (409) não impede o encerramento da conversa; o resto propaga. */
  private async resolveTicket(
    employeeId: string,
    ticketId: string,
    analyst: EmployeeRecord,
    resolution: string | undefined,
  ): Promise<ResolvedTicket | 'ALREADY_CLOSED'> {
    const started = Date.now();
    try {
      const result = await this.tickets.close(
        employeeId,
        ticketId,
        {
          resolution: 'RESOLVED',
          reason: resolution?.trim() || `Resolvido por ${analyst.name}.`,
          author: 'ANALYST',
          authorName: analyst.name,
        },
        `analyst-resolve-${ticketId}-${started}`,
      );
      return { ...result, durationMs: Date.now() - started };
    } catch (error) {
      if (error instanceof TicketConflictError) return 'ALREADY_CLOSED';
      throw error;
    }
  }

  /** Avisa o funcionário no chat, com o card do chamado resolvido. */
  private async announceResolution(
    conversationId: string,
    ticketId: string,
    analyst: EmployeeRecord,
    resolution: string | undefined,
    resolved: ResolvedTicket | 'ALREADY_CLOSED',
  ): Promise<void> {
    if (resolved === 'ALREADY_CLOSED') return;

    const note = resolution?.trim();
    const step: TraceStep = {
      id: 'analyst-resolve',
      tool: 'tickets.close',
      label: 'resolveu o chamado',
      status: resolved.attempts > 1 ? 'RETRIED' : 'OK',
      attempts: resolved.attempts,
      durationMs: resolved.durationMs,
      outputSummary: `${ticketId} resolvido por ${analyst.name}`,
    };

    await this.messages.append(
      {
        conversationId,
        author: 'AGENT',
        authorId: null,
        authorName: 'Nexo Assist',
        text: `${analyst.name} resolveu o ${ticketId}${note ? `: ${note}` : '.'} Se o problema voltar em até 7 dias, é só me chamar aqui que eu reabro.`,
        blocks: [{ type: 'TICKET_CARD', ticket: toTicketSummary(resolved.data) }],
      },
      {
        intent: 'TICKET_UPDATE',
        understood: {
          summary: 'O analista encerrou o atendimento e resolveu o chamado.',
          entities: { chamado: ticketId },
        },
        action: { type: 'ANALYST_RESOLVED', label: 'chamado resolvido pelo analista' },
        confidenceScore: 1,
        confidenceBand: 'HIGH',
        rationale: 'O analista marcou o problema como resolvido ao encerrar o atendimento.',
        rulesApplied: [],
        steps: [step],
        model: 'nenhum (ação do analista)',
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: resolved.durationMs,
      },
    );
  }

  /** De volta com o agent: ele pergunta se pode fechar o chamado ou se há outro problema. */
  private async askFollowUp(conversation: ConversationEntity, analystName: string): Promise<void> {
    const ticketId = conversation.followUpTicketId;

    await this.messages.append(
      {
        conversationId: conversation.id,
        author: 'AGENT',
        authorId: null,
        authorName: 'Nexo Assist',
        text: `Oi de novo! ${analystName} me devolveu a conversa.`,
        blocks: [followUpQuestion(ticketId)],
      },
      {
        intent: 'CLARIFY',
        understood: {
          summary: 'O analista devolveu a conversa ao agent.',
          entities: ticketId ? { chamado: ticketId } : {},
        },
        action: { type: 'FOLLOW_UP', label: 'perguntou se pode fechar o chamado' },
        confidenceScore: 1,
        confidenceBand: 'HIGH',
        rationale:
          'Depois do atendimento do analista, o agent confirma se o problema foi resolvido antes de fechar o chamado.',
        rulesApplied: ['Acompanhamento: confirmar a solução com o funcionário antes de fechar'],
        steps: [],
        model: 'nenhum (mensagem automática)',
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
      },
    );
  }

  private transition(
    conversation: ConversationEntity,
    action: ConversationAction,
    analystId: string,
    now: Date,
  ): ConversationEntity {
    switch (action) {
      case 'assume':
        return conversation.assume(analystId, now);
      case 'release':
        return conversation.releaseToAgent(analystId, now);
      case 'close':
        return conversation.close(analystId, now);
    }
  }
}
