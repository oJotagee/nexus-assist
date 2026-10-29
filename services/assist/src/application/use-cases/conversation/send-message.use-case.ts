import {
  type ConversationDto,
  type MessageBlock,
  type MessageDto,
  type SupportLevel,
  type TraceStep,
} from '@nexo/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';

import type { ConversationEntity } from '@/domain/entities/conversation.entity';
import type { DecisionTraceRecord, MessageRecord } from '@/domain/entities/message';
import { DailyBudgetExceededError, EmployeeNotFoundError } from '@/domain/errors/domain.error';
import {
  type HandoffDecision,
  evaluateHandoff,
  handoffRule,
} from '@/domain/policies/handoff-policy';
import { assertCanSend } from '@/domain/policies/session-limit';
import { ConversationViewBuilder } from '../../conversation-view.builder';
import {
  AGENT_RUNNER,
  type AgentHistoryMessage,
  type AgentRunner,
  type AgentTurnResult,
  type AgentTurnSink,
} from '../../ports/agent.port';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
  DRAFT_REPOSITORY,
  type DraftRepository,
  EMPLOYEE_REPOSITORY,
  type EmployeeRepository,
  MESSAGE_REPOSITORY,
  type MessageRepository,
} from '../../ports/repositories.port';
import { CLOCK, type Clock } from '../../ports/services.port';
import { TICKETS_GATEWAY, type TicketsGateway } from '../../ports/tickets-gateway.port';
import { toDraftDto, toMessageDto } from '../../presenters';
import { loadOwnedConversation } from './load-owned-conversation';

export const DAILY_TOKEN_BUDGET = Symbol('DAILY_TOKEN_BUDGET');

export type SendMessageInput = {
  conversationId: string;
  employeeId: string;
  text: string;
  reply?: { messageId: string; kind: 'QUICK_REPLY' | 'TICKET_PICKER'; value: string };
};

/** Canal de saída do turno (o controller transforma em eventos SSE). */
export interface SendMessageSink extends AgentTurnSink {
  message(message: MessageDto, agentWillReply: boolean): void;
}

export type SendMessageOutput = { message: MessageDto | null; conversation: ConversationDto };

const GROUP_LABEL: Record<SupportLevel, string> = { N1: 'Suporte N1', N2: 'Suporte N2' };
const RESOLVING_INTENTS = new Set(['FAQ', 'TICKET_STATUS']);

/**
 * Um turno do chat:
 *  1. gates: dono da conversa, limite da sessão, orçamento diário;
 *  2. grava a mensagem do funcionário;
 *  3. se a conversa está com (ou esperando) um analista, para aqui: o agent não responde;
 *  4. roda o agent em streaming;
 *  5. aplica a política de transferência em código;
 *  6. grava a resposta + o trace da decisão.
 */
@Injectable()
export class SendMessageUseCase {
  private readonly logger = new Logger(SendMessageUseCase.name);

  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepository,
    @Inject(DRAFT_REPOSITORY) private readonly drafts: DraftRepository,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(TICKETS_GATEWAY) private readonly tickets: TicketsGateway,
    @Inject(AGENT_RUNNER) private readonly agent: AgentRunner,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DAILY_TOKEN_BUDGET) private readonly dailyTokenBudget: number,
    private readonly view: ConversationViewBuilder,
  ) {}

  async execute(input: SendMessageInput, sink: SendMessageSink): Promise<SendMessageOutput> {
    let conversation = await loadOwnedConversation(
      this.conversations,
      input.conversationId,
      input.employeeId,
    );
    const employee = await this.employees.findById(input.employeeId);
    if (!employee) throw new EmployeeNotFoundError();

    const agentWillReply = conversation.agentCanReply();
    const session = await this.conversations.currentSession(conversation.id);
    assertCanSend(session, agentWillReply);
    if (agentWillReply) await this.assertWithinBudget(employee.id);

    const history = await this.messages.listBySession(session.id);
    const previousTraces = await this.messages.findTraces(
      history.filter((message) => message.author === 'AGENT').map((message) => message.id),
    );

    if (input.reply) await this.markReplied(conversation.id, input.reply);

    const employeeMessage = await this.messages.append({
      conversationId: conversation.id,
      author: 'EMPLOYEE',
      authorId: employee.id,
      authorName: employee.name,
      text: input.text.trim(),
      blocks: [],
    });
    sink.message(toMessageDto(employeeMessage), agentWillReply);

    conversation = conversation.receiveEmployeeMessage(this.clock.now());
    await this.conversations.save(conversation);

    if (!agentWillReply) {
      return { message: null, conversation: await this.view.build(conversation) };
    }

    const pendingDraft = await this.drafts.findPending(conversation.id);
    const result = await this.agent.run(
      {
        employee: { id: employee.id, name: employee.name, department: employee.department },
        conversationId: conversation.id,
        now: this.clock.now(),
        history: history.map(toHistory),
        userMessage: employeeMessage.text,
        sessionSummary: session.summary,
        focusTicketId: conversation.focusTicketId,
        pendingDraft: pendingDraft ? toDraftDto(pendingDraft) : null,
      },
      sink,
    );

    const lastAgentTrace = [...history]
      .reverse()
      .map((message) => previousTraces.get(message.id))
      .find((trace) => trace !== undefined);

    const handoff = evaluateHandoff({
      intent: result.decision.intent,
      confidenceBand: result.decision.confidence.band,
      requested: result.handoffRequest,
      draftPriority: result.draft?.priority ?? null,
      previousWasLowConfidenceClarify:
        lastAgentTrace?.intent === 'CLARIFY' && lastAgentTrace.confidenceBand === 'LOW',
    });

    const agentMessage = await this.persistReply(conversation, employee.id, result, handoff);
    const message = toMessageDto(agentMessage.record, agentMessage.trace);

    return {
      message,
      conversation: await this.view.build(
        (await this.conversations.findById(conversation.id)) ?? conversation,
      ),
    };
  }

  private async persistReply(
    conversation: ConversationEntity,
    employeeId: string,
    result: AgentTurnResult,
    handoff: HandoffDecision | null,
  ): Promise<{ record: MessageRecord; trace: DecisionTraceRecord }> {
    const now = this.clock.now();
    let next = conversation
      .focusOn(result.focusTicketId ?? conversation.focusTicketId)
      .markResolvedByAgent(!handoff && RESOLVING_INTENTS.has(result.decision.intent));

    const steps: TraceStep[] = [...result.steps];
    const rules = [...result.decision.rulesApplied];
    let text = result.text.trim() || 'Certo.';
    const blocks: MessageBlock[] = [...result.blocks];

    if (handoff) {
      const summary = result.handoffRequest?.summary ?? this.fallbackSummary(result);
      next = next.handOff({ reason: handoff.reason, summary, group: handoff.group }, now);
      steps.push(await this.transferTicket(employeeId, next.focusTicketId, handoff, summary));

      if (!rules.includes(handoff.rule)) rules.push(handoff.rule);
      if (handoff.forcedByPolicy) {
        text += `\n\nEncaminhei esta conversa para o ${GROUP_LABEL[handoff.group]}: um analista vai continuar o atendimento por aqui.`;
      }
      blocks.push({
        type: 'NOTICE',
        tone: 'warning',
        text: `Conversa transferida para o ${GROUP_LABEL[handoff.group]}. O assistente fica pausado até o analista liberar.`,
      });
    }

    const trace: DecisionTraceRecord = {
      intent: handoff ? 'HANDOFF' : result.decision.intent,
      understood: result.decision.understood,
      action: handoff
        ? { type: 'HANDOFF', label: `transferiu para o ${GROUP_LABEL[handoff.group]}` }
        : result.decision.action,
      confidenceScore: result.decision.confidence.score,
      confidenceBand: result.decision.confidence.band,
      rationale: handoff?.forcedByPolicy
        ? `${result.decision.rationale} Regra do service desk aplicada em código: ${handoffRule(handoff.reason)}.`
        : result.decision.rationale,
      rulesApplied: rules,
      steps,
      model: result.usage.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      latencyMs: result.usage.latencyMs,
    };

    await this.conversations.save(next);
    const record = await this.messages.append(
      {
        conversationId: conversation.id,
        author: 'AGENT',
        authorId: null,
        authorName: 'Nexo Assist',
        text,
        blocks,
      },
      trace,
    );

    if (handoff) {
      await this.messages.append({
        conversationId: conversation.id,
        author: 'SYSTEM',
        authorId: null,
        authorName: null,
        text: `Transferida para ${GROUP_LABEL[handoff.group]} · agent pausado`,
        blocks: [],
      });
    }

    return { record, trace };
  }

  /** Marca o chamado em foco como transferido no legado; falha aqui não impede a transferência. */
  private async transferTicket(
    employeeId: string,
    ticketId: string | null,
    handoff: HandoffDecision,
    summary: string,
  ): Promise<TraceStep> {
    const started = Date.now();
    const base = { id: 'handoff', tool: 'tickets.transfer', label: 'transferiu para um analista' };

    if (!ticketId) {
      return {
        ...base,
        status: 'OK',
        attempts: 0,
        durationMs: 0,
        outputSummary: 'sem chamado em foco',
      };
    }

    try {
      const { attempts } = await this.tickets.transfer(
        employeeId,
        ticketId,
        { group: handoff.group, summary },
        `handoff-${ticketId}-${started}`,
      );
      return {
        ...base,
        status: attempts > 1 ? 'RETRIED' : 'OK',
        attempts,
        durationMs: Date.now() - started,
        outputSummary: `${ticketId} na fila do ${GROUP_LABEL[handoff.group]}`,
      };
    } catch (error) {
      this.logger.warn(`Não foi possível marcar ${ticketId} como transferido: ${String(error)}`);
      return {
        ...base,
        status: 'FAILED',
        attempts: 1,
        durationMs: Date.now() - started,
        outputSummary: 'conversa transferida; o chamado não pôde ser atualizado no legado',
      };
    }
  }

  private fallbackSummary(result: AgentTurnResult): string {
    return `${result.decision.understood.summary} Motivo: ${result.decision.rationale}`.trim();
  }

  private async markReplied(
    conversationId: string,
    reply: NonNullable<SendMessageInput['reply']>,
  ): Promise<void> {
    const message = await this.messages.findById(reply.messageId);
    if (!message || message.conversationId !== conversationId || message.author !== 'AGENT') return;

    const blocks = message.blocks.map((block): MessageBlock => {
      if (reply.kind === 'QUICK_REPLY' && block.type === 'QUICK_REPLIES') {
        return { ...block, answered: reply.value };
      }
      if (reply.kind === 'TICKET_PICKER' && block.type === 'TICKET_PICKER') {
        return { ...block, selectedId: reply.value };
      }
      return block;
    });

    await this.messages.updateBlocks(message.id, blocks);
  }

  private async assertWithinBudget(employeeId: string): Promise<void> {
    if (this.dailyTokenBudget <= 0) return;

    const startOfDay = new Date(this.clock.now());
    startOfDay.setUTCHours(3, 0, 0, 0);
    if (startOfDay > this.clock.now()) startOfDay.setUTCDate(startOfDay.getUTCDate() - 1);

    const spent = await this.messages.sumTokensSince(employeeId, startOfDay);
    if (spent >= this.dailyTokenBudget) throw new DailyBudgetExceededError();
  }
}

function toHistory(message: MessageRecord): AgentHistoryMessage {
  return {
    author: message.author,
    authorName: message.authorName,
    text: message.text,
    blocks: message.blocks,
  };
}
