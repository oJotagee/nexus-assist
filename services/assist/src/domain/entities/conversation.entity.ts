import type { ConversationState, HandoffReason, SupportLevel } from '@nexo/shared';

import {
  InvalidConversationTransitionError,
  NotAssignedAnalystError,
} from '../errors/domain.error';

type ConversationProps = {
  id: string;
  employeeId: string;
  state: ConversationState;
  assignedAnalystId: string | null;
  handoffReason: HandoffReason | null;
  handoffSummary: string | null;
  handoffGroup: SupportLevel | null;
  handoffAt: Date | null;
  focusTicketId: string | null;
  resolvedByAgent: boolean;
  lastMessageAt: Date;
  createdAt: Date;
};

export type ConversationSnapshot = Readonly<ConversationProps>;

/**
 * Máquina de estados da conversa:
 *
 *   AGENT ──handoff──▶ WAITING_ANALYST ──assume──▶ WITH_ANALYST ──close──▶ CLOSED
 *     ▲                     │                          │
 *     └──── release ────────┴──────────────────────────┘
 *   CLOSED ──nova mensagem do funcionário──▶ AGENT
 *
 * O agent só responde em AGENT. Nos outros estados, a mensagem do funcionário é só gravada.
 */
export class ConversationEntity {
  private constructor(private readonly props: ConversationProps) {}

  static start(input: { id: string; employeeId: string }, now: Date): ConversationEntity {
    return new ConversationEntity({
      id: input.id,
      employeeId: input.employeeId,
      state: 'AGENT',
      assignedAnalystId: null,
      handoffReason: null,
      handoffSummary: null,
      handoffGroup: null,
      handoffAt: null,
      focusTicketId: null,
      resolvedByAgent: false,
      lastMessageAt: now,
      createdAt: now,
    });
  }

  static restore(props: ConversationProps): ConversationEntity {
    return new ConversationEntity({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get employeeId(): string {
    return this.props.employeeId;
  }
  get state(): ConversationState {
    return this.props.state;
  }
  get assignedAnalystId(): string | null {
    return this.props.assignedAnalystId;
  }
  get focusTicketId(): string | null {
    return this.props.focusTicketId;
  }

  isOwnedBy(employeeId: string): boolean {
    return this.props.employeeId === employeeId;
  }

  /** O agent fica pausado enquanto a conversa está com (ou esperando) um analista. */
  agentCanReply(): boolean {
    return this.props.state === 'AGENT' || this.props.state === 'CLOSED';
  }

  /** Mensagem do funcionário numa conversa encerrada a reabre com o agent. */
  receiveEmployeeMessage(now: Date): ConversationEntity {
    if (this.props.state === 'CLOSED') {
      return this.with({
        state: 'AGENT',
        assignedAnalystId: null,
        handoffReason: null,
        handoffSummary: null,
        handoffGroup: null,
        handoffAt: null,
        resolvedByAgent: false,
        lastMessageAt: now,
      });
    }

    return this.with({ lastMessageAt: now });
  }

  handOff(
    input: { reason: HandoffReason; summary: string; group: SupportLevel },
    now: Date,
  ): ConversationEntity {
    if (this.props.state !== 'AGENT') {
      throw new InvalidConversationTransitionError('A conversa já está com a equipe de analistas.');
    }

    return this.with({
      state: 'WAITING_ANALYST',
      handoffReason: input.reason,
      handoffSummary: input.summary.trim(),
      handoffGroup: input.group,
      handoffAt: now,
      resolvedByAgent: false,
      lastMessageAt: now,
    });
  }

  assume(analystId: string, now: Date): ConversationEntity {
    if (this.props.state === 'CLOSED') {
      throw new InvalidConversationTransitionError('A conversa já foi encerrada.');
    }
    if (this.props.state === 'WITH_ANALYST' && this.props.assignedAnalystId !== analystId) {
      throw new InvalidConversationTransitionError('Outro analista já assumiu esta conversa.');
    }

    return this.with({ state: 'WITH_ANALYST', assignedAnalystId: analystId, lastMessageAt: now });
  }

  releaseToAgent(analystId: string, now: Date): ConversationEntity {
    if (this.props.state === 'AGENT' || this.props.state === 'CLOSED') {
      throw new InvalidConversationTransitionError('A conversa não está com um analista.');
    }
    this.assertAssignedOrUnassigned(analystId);

    return this.with({
      state: 'AGENT',
      assignedAnalystId: null,
      handoffReason: null,
      handoffSummary: null,
      handoffGroup: null,
      handoffAt: null,
      lastMessageAt: now,
    });
  }

  close(analystId: string, now: Date): ConversationEntity {
    if (this.props.state === 'CLOSED') {
      throw new InvalidConversationTransitionError('A conversa já foi encerrada.');
    }
    this.assertAssignedOrUnassigned(analystId);

    return this.with({ state: 'CLOSED', lastMessageAt: now });
  }

  assertCanAnalystReply(analystId: string): void {
    if (this.props.state !== 'WITH_ANALYST' || this.props.assignedAnalystId !== analystId) {
      throw new NotAssignedAnalystError();
    }
  }

  touch(now: Date): ConversationEntity {
    return this.with({ lastMessageAt: now });
  }

  focusOn(ticketId: string | null): ConversationEntity {
    return this.with({ focusTicketId: ticketId });
  }

  markResolvedByAgent(resolved: boolean): ConversationEntity {
    return this.with({ resolvedByAgent: resolved });
  }

  toSnapshot(): ConversationSnapshot {
    return { ...this.props };
  }

  private assertAssignedOrUnassigned(analystId: string): void {
    const assigned = this.props.assignedAnalystId;
    if (assigned && assigned !== analystId) throw new NotAssignedAnalystError();
  }

  private with(changes: Partial<ConversationProps>): ConversationEntity {
    return new ConversationEntity({ ...this.props, ...changes });
  }
}
