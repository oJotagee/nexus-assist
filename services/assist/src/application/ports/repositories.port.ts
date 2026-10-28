import type { ConsoleFilter } from '@nexo/shared';

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

export const EMPLOYEE_REPOSITORY = Symbol('EMPLOYEE_REPOSITORY');
export const CONVERSATION_REPOSITORY = Symbol('CONVERSATION_REPOSITORY');
export const MESSAGE_REPOSITORY = Symbol('MESSAGE_REPOSITORY');
export const DRAFT_REPOSITORY = Symbol('DRAFT_REPOSITORY');
export const HELP_ARTICLE_REPOSITORY = Symbol('HELP_ARTICLE_REPOSITORY');

export interface EmployeeRepository {
  findById(id: string): Promise<EmployeeRecord | null>;
  findByEmail(email: string): Promise<EmployeeRecord | null>;
  findManyByIds(ids: string[]): Promise<EmployeeRecord[]>;
}

export type ConsoleListParams = {
  filter: ConsoleFilter;
  analystId: string;
  query?: string;
};

export interface ConversationRepository {
  findById(id: string): Promise<ConversationEntity | null>;
  findLatestByEmployee(employeeId: string): Promise<ConversationEntity | null>;
  /** Cria a conversa já com a primeira sessão. */
  create(conversation: ConversationEntity): Promise<void>;
  save(conversation: ConversationEntity): Promise<void>;
  currentSession(conversationId: string): Promise<SessionRecord>;
  startSession(conversationId: string, summary: string | null): Promise<SessionRecord>;
  listForConsole(params: ConsoleListParams): Promise<ConversationEntity[]>;
  countForConsole(analystId: string): Promise<Record<ConsoleFilter, number>>;
}

export interface MessageRepository {
  /**
   * Grava a mensagem (e o trace, se houver) na sessão atual e incrementa o contador da sessão,
   * na mesma transação.
   */
  append(message: NewMessage, trace?: DecisionTraceRecord): Promise<MessageRecord>;
  listByConversation(conversationId: string): Promise<MessageRecord[]>;
  listBySession(sessionId: string): Promise<MessageRecord[]>;
  lastByConversations(conversationIds: string[]): Promise<Map<string, MessageRecord>>;
  findById(id: string): Promise<MessageRecord | null>;
  updateBlocks(messageId: string, blocks: MessageRecord['blocks']): Promise<void>;
  findTrace(messageId: string): Promise<DecisionTraceRecord | null>;
  findTraces(messageIds: string[]): Promise<Map<string, DecisionTraceRecord>>;
  /** Tokens gastos pelo agent nas conversas do funcionário desde `since` (orçamento diário). */
  sumTokensSince(employeeId: string, since: Date): Promise<number>;
}

export interface DraftRepository {
  findById(id: string): Promise<TicketDraftEntity | null>;
  findPending(conversationId: string): Promise<TicketDraftEntity | null>;
  listByConversation(conversationId: string): Promise<TicketDraftEntity[]>;
  save(draft: TicketDraftEntity): Promise<void>;
}

export interface HelpArticleRepository {
  findAll(): Promise<HelpArticleRecord[]>;
}
