import {
  type TicketCategory,
  type TicketDeadline,
  type TicketImpact,
  type TicketPriority,
  type TicketStatus,
  type TicketType,
  canReopen,
  getTicketDeadline,
  isTicketOpen,
} from '@nexo/shared';

import {
  InvalidTicketError,
  TicketCannotBeReopenedError,
  TicketClosedError,
} from '../errors/ticket.error';

export type TicketUpdateAuthor = 'REQUESTER' | 'AGENT' | 'ANALYST' | 'SYSTEM';
export type TicketUpdateKind =
  | 'CREATED'
  | 'COMMENT'
  | 'STATUS_CHANGED'
  | 'REOPENED'
  | 'TRANSFERRED';
export type SupportGroup = 'N1' | 'N2';
export type TicketResolution = 'RESOLVED' | 'CANCELLED';

export type TicketUpdate = {
  kind: TicketUpdateKind;
  author: TicketUpdateAuthor;
  authorName: string | null;
  body: string;
  createdAt: Date;
};

type TicketProps = {
  id: string;
  type: TicketType;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  impact: TicketImpact;
  status: TicketStatus;
  requesterId: string;
  assignedGroup: string | null;
  assigneeName: string | null;
  createdAt: Date;
  lastUpdateAt: Date;
  resolvedAt: Date | null;
};

type TicketCreateInput = {
  id: string;
  type: TicketType;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  impact: TicketImpact;
  requesterId: string;
  author: TicketUpdateAuthor;
};

/** Toda mudança no chamado gera exatamente um registro no histórico. */
export type TicketChange = { ticket: TicketEntity; update: TicketUpdate };

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 4000;

export const SUPPORT_GROUP_LABEL: Record<SupportGroup, string> = {
  N1: 'Suporte N1',
  N2: 'Suporte N2',
};

export class TicketEntity {
  private constructor(private readonly props: TicketProps) {
    TicketEntity.validate(props);
  }

  get id(): string {
    return this.props.id;
  }
  get type(): TicketType {
    return this.props.type;
  }
  get title(): string {
    return this.props.title;
  }
  get description(): string {
    return this.props.description;
  }
  get category(): TicketCategory {
    return this.props.category;
  }
  get priority(): TicketPriority {
    return this.props.priority;
  }
  get impact(): TicketImpact {
    return this.props.impact;
  }
  get status(): TicketStatus {
    return this.props.status;
  }
  get requesterId(): string {
    return this.props.requesterId;
  }
  get assignedGroup(): string | null {
    return this.props.assignedGroup;
  }
  get assigneeName(): string | null {
    return this.props.assigneeName;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get lastUpdateAt(): Date {
    return this.props.lastUpdateAt;
  }
  get resolvedAt(): Date | null {
    return this.props.resolvedAt;
  }

  static create(input: TicketCreateInput, now: Date): TicketChange {
    const ticket = new TicketEntity({
      id: input.id,
      type: input.type,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      priority: input.priority,
      impact: input.impact,
      status: 'OPEN',
      requesterId: input.requesterId,
      assignedGroup: SUPPORT_GROUP_LABEL.N1,
      assigneeName: null,
      createdAt: now,
      lastUpdateAt: now,
      resolvedAt: null,
    });

    return {
      ticket,
      update: {
        kind: 'CREATED',
        author: input.author,
        authorName: null,
        body: 'Chamado aberto.',
        createdAt: now,
      },
    };
  }

  static restore(props: TicketProps): TicketEntity {
    return new TicketEntity({ ...props });
  }

  isOwnedBy(employeeId: string): boolean {
    return this.props.requesterId === employeeId;
  }

  isOpen(): boolean {
    return isTicketOpen(this.props.status);
  }

  deadline(now: Date): TicketDeadline {
    return getTicketDeadline(this.props, now);
  }

  canReopen(now: Date): boolean {
    return canReopen(this.props, now);
  }

  /** Complementa o chamado. O prazo recomeça a contar a partir desta atualização. */
  addComment(
    input: { author: TicketUpdateAuthor; authorName: string | null; body: string },
    now: Date,
  ): TicketChange {
    if (!this.isOpen()) throw new TicketClosedError(this.id);

    const body = input.body.trim();
    if (!body) throw new InvalidTicketError('A atualização não pode ser vazia.');

    return {
      ticket: this.with({ lastUpdateAt: now }),
      update: {
        kind: 'COMMENT',
        author: input.author,
        authorName: input.authorName,
        body,
        createdAt: now,
      },
    };
  }

  reopen(input: { author: TicketUpdateAuthor; reason: string }, now: Date): TicketChange {
    if (!this.canReopen(now)) throw new TicketCannotBeReopenedError(this.id);

    return {
      ticket: this.with({ status: 'OPEN', resolvedAt: null, lastUpdateAt: now }),
      update: {
        kind: 'REOPENED',
        author: input.author,
        authorName: null,
        body: input.reason.trim() || 'Chamado reaberto.',
        createdAt: now,
      },
    };
  }

  /** Encaminha para um grupo de analistas com o resumo do caso. */
  transfer(input: { group: SupportGroup; summary: string }, now: Date): TicketChange {
    if (!this.isOpen()) throw new TicketClosedError(this.id);

    const groupLabel = SUPPORT_GROUP_LABEL[input.group];

    return {
      ticket: this.with({
        status: 'WAITING_ANALYST',
        assignedGroup: groupLabel,
        assigneeName: null,
        lastUpdateAt: now,
      }),
      update: {
        kind: 'TRANSFERRED',
        author: 'AGENT',
        authorName: null,
        body: `Transferido para ${groupLabel}. ${input.summary.trim()}`.trim(),
        createdAt: now,
      },
    };
  }

  /**
   * Encerra a pedido do funcionário: RESOLVED (resolvido; pode ser reaberto em até 7 dias) ou
   * CANCELLED (fecha sem resolução, ex.: substituído por um chamado sobre outro problema).
   */
  close(
    input: {
      resolution: TicketResolution;
      reason: string;
      author: TicketUpdateAuthor;
      authorName?: string | null;
    },
    now: Date,
  ): TicketChange {
    if (!this.isOpen()) throw new TicketClosedError(this.id);

    const resolved = input.resolution === 'RESOLVED';

    return {
      ticket: this.with({
        status: resolved ? 'RESOLVED' : 'CLOSED',
        resolvedAt: now,
        lastUpdateAt: now,
      }),
      update: {
        kind: 'STATUS_CHANGED',
        author: input.author,
        authorName: input.authorName ?? null,
        body: input.reason.trim() || (resolved ? 'Resolvido.' : 'Cancelado.'),
        createdAt: now,
      },
    };
  }

  toJSON(): TicketProps {
    return { ...this.props };
  }

  private with(changes: Partial<TicketProps>): TicketEntity {
    return new TicketEntity({ ...this.props, ...changes });
  }

  private static validate(props: TicketProps): void {
    if (!/^(INC|REQ)-\d+$/.test(props.id)) {
      throw new InvalidTicketError(`Identificador inválido: ${props.id}`);
    }
    if (!props.id.startsWith(props.type)) {
      throw new InvalidTicketError('O prefixo do identificador não bate com o tipo do chamado.');
    }
    if (!props.title) throw new InvalidTicketError('O título é obrigatório.');
    if (props.title.length > TITLE_MAX) {
      throw new InvalidTicketError(`O título deve ter até ${TITLE_MAX} caracteres.`);
    }
    if (!props.description) throw new InvalidTicketError('A descrição é obrigatória.');
    if (props.description.length > DESCRIPTION_MAX) {
      throw new InvalidTicketError(`A descrição deve ter até ${DESCRIPTION_MAX} caracteres.`);
    }
    if (!props.requesterId) throw new InvalidTicketError('O solicitante é obrigatório.');
  }
}
