import {
  TICKET_PRIORITY_LABEL,
  type DraftMode,
  type DraftStatus,
  type TicketCategory,
  type TicketImpact,
  type TicketPriority,
  type TicketType,
  computeDueAt,
} from '@nexo/shared';

import { DraftNotPendingError, InvalidDraftError } from '../errors/domain.error';

export type TicketDraftProps = {
  id: string;
  conversationId: string;
  mode: DraftMode;
  targetTicketId: string | null;
  type: TicketType;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  priorityRule: string;
  impact: TicketImpact;
  dueAt: Date;
  status: DraftStatus;
  idempotencyKey: string;
  resultTicketId: string | null;
};

export type DraftEdit = Partial<
  Pick<TicketDraftProps, 'title' | 'description' | 'category' | 'priority'>
>;

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 4000;

/**
 * Rascunho de chamado (Anexo A: "o agent mostra um rascunho e só cria ou atualiza o chamado
 * depois da confirmação do funcionário"). O agent só consegue criar rascunhos; a escrita no
 * sistema de chamados acontece apenas no endpoint de confirmação, acionado pelo botão.
 */
export class TicketDraftEntity {
  private constructor(private readonly props: TicketDraftProps) {
    TicketDraftEntity.validate(props);
  }

  static create(
    input: Omit<TicketDraftProps, 'status' | 'resultTicketId' | 'dueAt'>,
    now: Date,
  ): TicketDraftEntity {
    return new TicketDraftEntity({
      ...input,
      title: input.title.trim(),
      description: input.description.trim(),
      dueAt: computeDueAt(input.priority, now),
      status: 'PENDING',
      resultTicketId: null,
    });
  }

  static restore(props: TicketDraftProps): TicketDraftEntity {
    return new TicketDraftEntity({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get conversationId(): string {
    return this.props.conversationId;
  }
  get mode(): DraftMode {
    return this.props.mode;
  }
  get status(): DraftStatus {
    return this.props.status;
  }
  get targetTicketId(): string | null {
    return this.props.targetTicketId;
  }
  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }

  isPending(): boolean {
    return this.props.status === 'PENDING';
  }

  edit(changes: DraftEdit, now: Date): TicketDraftEntity {
    this.assertPending();

    const priorityChanged = changes.priority && changes.priority !== this.props.priority;
    const priority = changes.priority ?? this.props.priority;

    return new TicketDraftEntity({
      ...this.props,
      title: changes.title?.trim() ?? this.props.title,
      description: changes.description?.trim() ?? this.props.description,
      category: changes.category ?? this.props.category,
      priority,
      priorityRule: priorityChanged
        ? `${TICKET_PRIORITY_LABEL[priority]}: ajustada pelo funcionário no rascunho`
        : this.props.priorityRule,
      dueAt: priorityChanged ? computeDueAt(priority, now) : this.props.dueAt,
    });
  }

  confirm(resultTicketId: string): TicketDraftEntity {
    this.assertPending();
    return new TicketDraftEntity({ ...this.props, status: 'CONFIRMED', resultTicketId });
  }

  cancel(): TicketDraftEntity {
    this.assertPending();
    return new TicketDraftEntity({ ...this.props, status: 'CANCELLED' });
  }

  toSnapshot(): Readonly<TicketDraftProps> {
    return { ...this.props };
  }

  private assertPending(): void {
    if (!this.isPending()) throw new DraftNotPendingError();
  }

  private static validate(props: TicketDraftProps): void {
    if (!props.title) throw new InvalidDraftError('O rascunho precisa de um título.');
    if (props.title.length > TITLE_MAX) {
      throw new InvalidDraftError(`O título deve ter até ${TITLE_MAX} caracteres.`);
    }
    if (!props.description) throw new InvalidDraftError('O rascunho precisa de uma descrição.');
    if (props.description.length > DESCRIPTION_MAX) {
      throw new InvalidDraftError(`A descrição deve ter até ${DESCRIPTION_MAX} caracteres.`);
    }
    if (props.mode !== 'CREATE' && !props.targetTicketId) {
      throw new InvalidDraftError('Atualizar ou reabrir exige o chamado de destino.');
    }
  }
}
