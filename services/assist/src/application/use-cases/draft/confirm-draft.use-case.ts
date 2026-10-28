import {
  type ConversationDto,
  TICKET_PRIORITY_LABEL,
  type TraceStep,
  formatDueAt,
} from '@nexo/shared';
import { Inject, Injectable } from '@nestjs/common';

import type { DecisionTraceRecord } from '@/domain/entities/message';
import { DraftNotPendingError } from '@/domain/errors/domain.error';
import type { TicketDraftEntity } from '@/domain/entities/ticket-draft.entity';
import { ConversationViewBuilder } from '../../conversation-view.builder';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
  DRAFT_REPOSITORY,
  type DraftRepository,
  MESSAGE_REPOSITORY,
  type MessageRepository,
} from '../../ports/repositories.port';
import { CLOCK, type Clock } from '../../ports/services.port';
import {
  type GatewayResult,
  TICKETS_GATEWAY,
  type Ticket,
  type TicketsGateway,
} from '../../ports/tickets-gateway.port';
import { toTicketSummary } from '../../presenters';
import { loadOwnedDraft } from './load-owned-draft';

type ConfirmDraftInput = { conversationId: string; draftId: string; employeeId: string };

const ACTION_BY_MODE = {
  CREATE: { tool: 'tickets.create', label: 'criou o chamado', intent: 'TICKET_CREATE' },
  UPDATE: { tool: 'tickets.addUpdate', label: 'atualizou o chamado', intent: 'TICKET_UPDATE' },
  REOPEN: { tool: 'tickets.reopen', label: 'reabriu o chamado', intent: 'TICKET_UPDATE' },
} as const;

/**
 * Única porta de escrita de chamados vinda do chat. É acionada pelo botão "Confirmar",
 * nunca pelo LLM. A idempotencyKey do rascunho é reaproveitada em toda tentativa, então
 * clicar duas vezes ou repetir depois de uma falha nunca cria dois chamados.
 */
@Injectable()
export class ConfirmDraftUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(DRAFT_REPOSITORY) private readonly drafts: DraftRepository,
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepository,
    @Inject(TICKETS_GATEWAY) private readonly tickets: TicketsGateway,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly view: ConversationViewBuilder,
  ) {}

  async execute(input: ConfirmDraftInput): Promise<ConversationDto> {
    const { conversation, draft } = await loadOwnedDraft(this.repositories(), input);
    const startedAt = Date.now();

    if (!draft.isPending()) throw new DraftNotPendingError();

    const result = await this.submit(input.employeeId, draft);
    const ticket = result.data;
    const now = this.clock.now();

    // Duplo clique: o legado deduplica pela chave; aqui só o primeiro registra a confirmação.
    if (!(await this.drafts.confirmIfPending(draft.id, ticket.id)))
      return this.view.build(conversation);

    await this.conversations.save(conversation.focusOn(ticket.id));
    await this.messages.append(
      {
        conversationId: conversation.id,
        author: 'AGENT',
        authorId: null,
        authorName: 'Nexo Assist',
        text: this.confirmationText(draft, ticket, now),
        blocks: [{ type: 'TICKET_CARD', ticket: toTicketSummary(ticket) }],
      },
      this.trace(draft, result, Date.now() - startedAt),
    );

    return this.view.build(conversation);
  }

  private submit(employeeId: string, draft: TicketDraftEntity): Promise<GatewayResult<Ticket>> {
    const data = draft.toSnapshot();

    switch (data.mode) {
      case 'CREATE':
        return this.tickets.create(
          employeeId,
          {
            type: data.type,
            title: data.title,
            description: data.description,
            category: data.category,
            priority: data.priority,
            impact: data.impact,
          },
          data.idempotencyKey,
        );
      case 'UPDATE':
        return this.tickets.addUpdate(
          employeeId,
          data.targetTicketId ?? '',
          { body: data.description, author: 'AGENT' },
          data.idempotencyKey,
        );
      case 'REOPEN':
        return this.tickets.reopen(
          employeeId,
          data.targetTicketId ?? '',
          data.description,
          data.idempotencyKey,
        );
    }
  }

  private confirmationText(draft: TicketDraftEntity, ticket: Ticket, now: Date): string {
    const { mode, priority } = draft.toSnapshot();
    const due = ticket.deadline.dueAt ? formatDueAt(ticket.deadline.dueAt, now) : null;
    const deadline = due ? ` A equipe responde até ${due}.` : '';

    if (mode === 'CREATE') {
      return `Pronto! Abri o chamado ${ticket.id} com prioridade ${TICKET_PRIORITY_LABEL[priority].toLowerCase()}.${deadline} Você pode acompanhar por aqui.`;
    }
    if (mode === 'REOPEN') {
      return `Reabri o chamado ${ticket.id} com as novas informações.${deadline}`;
    }
    return `Adicionei as informações ao chamado ${ticket.id}.${deadline}`;
  }

  private trace(
    draft: TicketDraftEntity,
    result: GatewayResult<Ticket>,
    durationMs: number,
  ): DecisionTraceRecord {
    const action = ACTION_BY_MODE[draft.mode];
    const step: TraceStep = {
      id: 'confirm',
      tool: action.tool,
      label: action.label,
      status: result.attempts > 1 ? 'RETRIED' : 'OK',
      attempts: result.attempts,
      durationMs,
      outputSummary: `${result.data.id} gravado no sistema de chamados`,
    };

    return {
      intent: action.intent,
      understood: { summary: 'O funcionário confirmou o rascunho.', entities: {} },
      action: { type: `CONFIRM_${draft.mode}`, label: action.label },
      confidenceScore: 1,
      confidenceBand: 'HIGH',
      rationale:
        'O chamado só é gravado depois da confirmação explícita do funcionário no rascunho.',
      rulesApplied: ['Anexo A · Abertura: o agent mostra um rascunho e só grava após confirmação'],
      steps: [step],
      model: 'nenhum (ação do funcionário)',
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: durationMs,
    };
  }

  private repositories() {
    return { conversations: this.conversations, drafts: this.drafts };
  }
}
