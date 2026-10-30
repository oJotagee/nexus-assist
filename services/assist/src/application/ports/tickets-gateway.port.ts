import type {
  TicketCategory,
  TicketImpact,
  TicketPriority,
  TicketStatus,
  TicketType,
} from '@nexo/shared';

export const TICKETS_GATEWAY = Symbol('TICKETS_GATEWAY');

export type TicketScope = 'open' | 'recent' | 'all';

/** Chamado como o sistema legado devolve (datas já convertidas). */
export type Ticket = {
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
  deadline: { dueAt: Date | null; overdue: boolean; slaLabel: string };
  canReopen: boolean;
};

export type TicketHistoryEntry = {
  kind: string;
  author: string;
  authorName: string | null;
  body: string;
  createdAt: Date;
};

export type TicketDetail = Ticket & { updates: TicketHistoryEntry[] };

/** Toda chamada informa quantas tentativas foram necessárias (vai para o trace). */
export type GatewayResult<T> = { data: T; attempts: number };

export type CreateTicketCommand = {
  type: TicketType;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  impact: TicketImpact;
};

/**
 * Cliente do sistema de chamados. Todas as operações recebem o funcionário: não existe
 * "buscar chamado por id" sem dono. Escritas exigem idempotencyKey para poderem ser repetidas.
 * Lança TicketsUnavailableError, TicketNotFoundError ou TicketConflictError.
 */
export interface TicketsGateway {
  list(employeeId: string, scope: TicketScope): Promise<GatewayResult<Ticket[]>>;
  get(employeeId: string, ticketId: string): Promise<GatewayResult<TicketDetail>>;
  create(
    employeeId: string,
    command: CreateTicketCommand,
    idempotencyKey: string,
  ): Promise<GatewayResult<Ticket>>;
  addUpdate(
    employeeId: string,
    ticketId: string,
    update: { body: string; author: 'AGENT' | 'ANALYST' | 'REQUESTER'; authorName?: string },
    idempotencyKey: string,
  ): Promise<GatewayResult<Ticket>>;
  reopen(
    employeeId: string,
    ticketId: string,
    reason: string,
    idempotencyKey: string,
  ): Promise<GatewayResult<Ticket>>;
  transfer(
    employeeId: string,
    ticketId: string,
    transfer: { group: 'N1' | 'N2'; summary: string },
    idempotencyKey: string,
  ): Promise<GatewayResult<Ticket>>;
  /** Fecha como resolvido (reabrível em 7 dias) ou cancelado. */
  close(
    employeeId: string,
    ticketId: string,
    close: {
      resolution: 'RESOLVED' | 'CANCELLED';
      reason: string;
      /** Quem fecha: o agent (padrão) ou o analista, com o nome no histórico do chamado. */
      author?: 'AGENT' | 'ANALYST';
      authorName?: string;
    },
    idempotencyKey: string,
  ): Promise<GatewayResult<Ticket>>;
}
