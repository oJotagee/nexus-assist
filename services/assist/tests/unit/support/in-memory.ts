import { type ConsoleFilter, SEED_EMPLOYEES, type TicketType } from '@nexo/shared';

import type {
  ConsoleListParams,
  ConversationRepository,
  DraftRepository,
  EmployeeRepository,
  HelpArticleRepository,
  MessageRepository,
} from '@/application/ports/repositories.port';
import type { Clock, IdGenerator } from '@/application/ports/services.port';
import type {
  CreateTicketCommand,
  GatewayResult,
  Ticket,
  TicketDetail,
  TicketScope,
  TicketsGateway,
} from '@/application/ports/tickets-gateway.port';
import type { ConversationEntity } from '@/domain/entities/conversation.entity';
import type {
  DecisionTraceRecord,
  EmployeeRecord,
  HelpArticleRecord,
  MessageRecord,
  NewMessage,
  SessionRecord,
} from '@/domain/entities/message';
import type { TicketDraftEntity } from '@/domain/entities/ticket-draft.entity';
import { TicketNotFoundError } from '@/domain/errors/domain.error';
import { countsTowardSessionLimit } from '@/domain/policies/session-limit';

export const at = (iso: string) => new Date(`${iso}-03:00`);
export const NOW = at('2026-10-27T10:00:00');

export class FixedClock implements Clock {
  constructor(public current: Date = NOW) {}
  now(): Date {
    return this.current;
  }
}

export class SequentialIds implements IdGenerator {
  private counter = 0;
  next(): string {
    this.counter += 1;
    return `id-${this.counter}`;
  }
}

export class InMemoryEmployees implements EmployeeRepository {
  readonly employees: EmployeeRecord[] = SEED_EMPLOYEES.map((person) => ({
    ...person,
    passwordChangedAt: at('2026-09-15T10:00:00'),
  }));

  async findById(id: string) {
    return this.employees.find((person) => person.id === id) ?? null;
  }
  async findByEmail(email: string) {
    return this.employees.find((person) => person.email === email) ?? null;
  }
  async findManyByIds(ids: string[]) {
    return this.employees.filter((person) => ids.includes(person.id));
  }
}

export class InMemoryConversations implements ConversationRepository {
  readonly items = new Map<string, ConversationEntity>();
  readonly sessions: SessionRecord[] = [];

  async findById(id: string) {
    return this.items.get(id) ?? null;
  }
  async findLatestByEmployee(employeeId: string) {
    return [...this.items.values()].reverse().find((c) => c.employeeId === employeeId) ?? null;
  }
  async create(conversation: ConversationEntity) {
    this.items.set(conversation.id, conversation);
    this.sessions.push({
      id: `session-${conversation.id}-0`,
      conversationId: conversation.id,
      index: 0,
      messageCount: 0,
      summary: null,
      startedAt: NOW,
    });
  }
  async save(conversation: ConversationEntity) {
    this.items.set(conversation.id, conversation);
  }
  async currentSession(conversationId: string) {
    const sessions = this.sessions.filter((s) => s.conversationId === conversationId);
    const session = sessions.at(-1);
    if (!session) throw new Error('sem sessão');
    return session;
  }
  async startSession(conversationId: string, summary: string | null) {
    const current = await this.currentSession(conversationId);
    const session = {
      id: `session-${conversationId}-${current.index + 1}`,
      conversationId,
      index: current.index + 1,
      messageCount: 0,
      summary,
      startedAt: NOW,
    };
    this.sessions.push(session);
    return session;
  }
  async listForConsole(_params: ConsoleListParams) {
    return [...this.items.values()];
  }
  async countForConsole(): Promise<Record<ConsoleFilter, number>> {
    return { all: this.items.size, waiting: 0, agent: 0, mine: 0 };
  }
}

export class InMemoryMessages implements MessageRepository {
  readonly messages: MessageRecord[] = [];
  readonly traces = new Map<string, DecisionTraceRecord>();

  constructor(private readonly conversations: InMemoryConversations) {}

  async append(message: NewMessage, trace?: DecisionTraceRecord) {
    const session = await this.conversations.currentSession(message.conversationId);
    const record: MessageRecord = {
      ...message,
      id: `msg-${this.messages.length + 1}`,
      sessionId: session.id,
      createdAt: new Date(NOW.getTime() + this.messages.length),
    };
    this.messages.push(record);
    if (trace) this.traces.set(record.id, trace);
    if (countsTowardSessionLimit(message.author)) session.messageCount += 1;
    return record;
  }
  async listByConversation(conversationId: string) {
    return this.messages.filter((m) => m.conversationId === conversationId);
  }
  async listBySession(sessionId: string) {
    return this.messages.filter((m) => m.sessionId === sessionId);
  }
  async lastByConversations(ids: string[]) {
    return new Map(
      ids.flatMap((id) => {
        const last = this.messages.filter((m) => m.conversationId === id).at(-1);
        return last ? [[id, last] as const] : [];
      }),
    );
  }
  async findById(id: string) {
    return this.messages.find((m) => m.id === id) ?? null;
  }
  async updateBlocks(messageId: string, blocks: MessageRecord['blocks']) {
    const message = this.messages.find((m) => m.id === messageId);
    if (message) message.blocks = blocks;
  }
  async findTrace(messageId: string) {
    return this.traces.get(messageId) ?? null;
  }
  async findTraces(ids: string[]) {
    return new Map(
      ids.flatMap((id) => {
        const trace = this.traces.get(id);
        return trace ? [[id, trace] as const] : [];
      }),
    );
  }
  async sumTokensSince() {
    return [...this.traces.values()].reduce((sum, t) => sum + t.inputTokens + t.outputTokens, 0);
  }
}

export class InMemoryDrafts implements DraftRepository {
  readonly items = new Map<string, TicketDraftEntity>();

  async findById(id: string) {
    return this.items.get(id) ?? null;
  }
  async findPending(conversationId: string) {
    return (
      [...this.items.values()].find((d) => d.conversationId === conversationId && d.isPending()) ??
      null
    );
  }
  async listByConversation(conversationId: string) {
    return [...this.items.values()].filter((d) => d.conversationId === conversationId);
  }
  async save(draft: TicketDraftEntity) {
    this.items.set(draft.id, draft);
  }
  async confirmIfPending(id: string, resultTicketId: string) {
    const draft = this.items.get(id);
    if (!draft?.isPending()) return false;
    this.items.set(id, draft.confirm(resultTicketId));
    return true;
  }
}

export class InMemoryArticles implements HelpArticleRepository {
  constructor(readonly articles: HelpArticleRecord[] = []) {}
  async findAll() {
    return this.articles;
  }
}

export function buildTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 'INC-20311',
    type: 'INC',
    title: 'Notebook lento após atualização do Windows',
    description: 'Lentidão geral desde a atualização.',
    category: 'HARDWARE',
    priority: 'MEDIUM',
    impact: 'SELF',
    status: 'WAITING_ANALYST',
    requesterId: 'emp_ana',
    assignedGroup: 'Suporte N1',
    assigneeName: null,
    createdAt: at('2026-10-16T14:20:00'),
    lastUpdateAt: at('2026-10-21T10:00:00'),
    resolvedAt: null,
    deadline: { dueAt: at('2026-10-26T10:00:00'), overdue: true, slaLabel: '3 dias úteis' },
    canReopen: false,
    ...overrides,
  };
}

/** Sistema de chamados falso: registra as chamadas e respeita a idempotência. */
export class FakeTicketsGateway implements TicketsGateway {
  readonly tickets: Ticket[] = [];
  readonly calls: { method: string; key?: string; args: unknown[] }[] = [];
  private readonly byKey = new Map<string, Ticket>();
  private sequence: Record<TicketType, number> = { INC: 20341, REQ: 10502 };
  /** Falhas a simular antes do sucesso (conta como tentativas). */
  attemptsPerCall = 1;
  failWith: Error | null = null;

  async list(employeeId: string, _scope: TicketScope): Promise<GatewayResult<Ticket[]>> {
    this.calls.push({ method: 'list', args: [employeeId] });
    this.throwIfFailing();
    return this.result(this.tickets.filter((t) => t.requesterId === employeeId));
  }

  async get(employeeId: string, ticketId: string): Promise<GatewayResult<TicketDetail>> {
    this.calls.push({ method: 'get', args: [employeeId, ticketId] });
    this.throwIfFailing();
    return this.result({ ...this.owned(employeeId, ticketId), updates: [] });
  }

  async create(employeeId: string, command: CreateTicketCommand, key: string) {
    return this.write('create', key, [employeeId, command], () => {
      const id = `${command.type}-${this.sequence[command.type]++}`;
      const ticket = buildTicket({
        ...command,
        id,
        requesterId: employeeId,
        status: 'OPEN',
        deadline: { dueAt: at('2026-10-27T14:00:00'), overdue: false, slaLabel: '4 horas úteis' },
      });
      this.tickets.push(ticket);
      return ticket;
    });
  }

  async addUpdate(employeeId: string, ticketId: string, update: { body: string }, key: string) {
    return this.write('addUpdate', key, [employeeId, ticketId, update], () =>
      this.owned(employeeId, ticketId),
    );
  }

  async reopen(employeeId: string, ticketId: string, reason: string, key: string) {
    return this.write('reopen', key, [employeeId, ticketId, reason], () => {
      const ticket = this.owned(employeeId, ticketId);
      ticket.status = 'OPEN';
      return ticket;
    });
  }

  async transfer(
    employeeId: string,
    ticketId: string,
    transfer: { group: 'N1' | 'N2'; summary: string },
    key: string,
  ) {
    return this.write('transfer', key, [employeeId, ticketId, transfer], () => {
      const ticket = this.owned(employeeId, ticketId);
      ticket.status = 'WAITING_ANALYST';
      return ticket;
    });
  }

  private async write(
    method: string,
    key: string,
    args: unknown[],
    run: () => Ticket,
  ): Promise<GatewayResult<Ticket>> {
    this.calls.push({ method, key, args });
    this.throwIfFailing();
    const existing = this.byKey.get(key);
    if (existing) return this.result(existing);
    const ticket = run();
    this.byKey.set(key, ticket);
    return this.result(ticket);
  }

  private owned(employeeId: string, ticketId: string): Ticket {
    const ticket = this.tickets.find((t) => t.id === ticketId && t.requesterId === employeeId);
    if (!ticket) throw new TicketNotFoundError(ticketId);
    return ticket;
  }

  private throwIfFailing(): void {
    if (this.failWith) throw this.failWith;
  }

  private result<T>(data: T): GatewayResult<T> {
    return { data, attempts: this.attemptsPerCall };
  }
}

export function createRepositories() {
  const conversations = new InMemoryConversations();
  return {
    conversations,
    messages: new InMemoryMessages(conversations),
    drafts: new InMemoryDrafts(),
    employees: new InMemoryEmployees(),
    articles: new InMemoryArticles(),
    tickets: new FakeTicketsGateway(),
    clock: new FixedClock(),
    ids: new SequentialIds(),
  };
}
