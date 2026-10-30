import type { ConsoleConversationDto } from '@nexo/shared';
import { Inject, Injectable } from '@nestjs/common';

import { ConversationNotFoundError, EmployeeNotFoundError } from '@/domain/errors/domain.error';
import { GetConsoleConversationUseCase } from './get-console-conversation.use-case';
import { followUpQuestion } from '@/domain/policies/follow-up';
import type { ConversationEntity } from '@/domain/entities/conversation.entity';
import { CLOCK, type Clock } from '../../ports/services.port';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
  EMPLOYEE_REPOSITORY,
  type EmployeeRepository,
  MESSAGE_REPOSITORY,
  type MessageRepository,
} from '../../ports/repositories.port';

export type ConversationAction = 'assume' | 'release' | 'close';

type ChangeStateInput = { conversationId: string; analystId: string; action: ConversationAction };

const TIME = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Assumir (agent pausa), devolver ao agent ou encerrar. Cada transição deixa um marcador
 * de sistema na conversa, visível para o funcionário e no console.
 */
@Injectable()
export class ChangeConversationStateUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepository,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly getConversation: GetConsoleConversationUseCase,
  ) {}

  async execute({
    conversationId,
    analystId,
    action,
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

    return this.getConversation.execute(conversationId);
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
