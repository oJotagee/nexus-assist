import type {
  DecisionTraceDto,
  MessageDto,
  TicketDraftDto,
  TicketSummaryDto,
  UserDto,
} from '@nexo/shared';

import type { DecisionTraceRecord, EmployeeRecord, MessageRecord } from '@/domain/entities/message';
import type { TicketDraftEntity } from '@/domain/entities/ticket-draft.entity';
import type { Ticket } from './ports/tickets-gateway.port';

export function toUserDto(employee: EmployeeRecord): UserDto {
  return {
    id: employee.id,
    name: employee.name,
    email: employee.email,
    department: employee.department,
    role: employee.role,
    supportLevel: employee.supportLevel,
    passwordChangedAt: employee.passwordChangedAt.toISOString(),
  };
}

export function toTicketSummary(ticket: Ticket): TicketSummaryDto {
  return {
    id: ticket.id,
    type: ticket.type,
    title: ticket.title,
    description: ticket.description,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    assignedGroup: ticket.assignedGroup,
    assigneeName: ticket.assigneeName,
    createdAt: ticket.createdAt.toISOString(),
    lastUpdateAt: ticket.lastUpdateAt.toISOString(),
    dueAt: ticket.deadline.dueAt?.toISOString() ?? null,
    overdue: ticket.deadline.overdue,
    slaLabel: ticket.deadline.slaLabel,
    canReopen: ticket.canReopen,
  };
}

export function toDraftDto(draft: TicketDraftEntity): TicketDraftDto {
  const {
    conversationId: _conversation,
    idempotencyKey: _key,
    dueAt,
    ...rest
  } = draft.toSnapshot();
  return { ...rest, dueAt: dueAt.toISOString() };
}

export function toTraceDto(trace: DecisionTraceRecord): DecisionTraceDto {
  return {
    intent: trace.intent,
    understood: trace.understood,
    action: trace.action,
    confidence: { score: trace.confidenceScore, band: trace.confidenceBand },
    rationale: trace.rationale,
    rulesApplied: trace.rulesApplied,
    steps: trace.steps,
    usage: {
      model: trace.model,
      inputTokens: trace.inputTokens,
      outputTokens: trace.outputTokens,
      latencyMs: trace.latencyMs,
    },
  };
}

export function toMessageDto(
  message: MessageRecord,
  trace?: DecisionTraceRecord | null,
): MessageDto {
  return {
    id: message.id,
    author: message.author,
    authorName: message.authorName,
    text: message.text,
    blocks: message.blocks,
    createdAt: message.createdAt.toISOString(),
    trace: trace
      ? {
          intent: trace.intent,
          action: trace.action,
          confidence: { score: trace.confidenceScore, band: trace.confidenceBand },
          steps: trace.steps.map(({ input: _input, outputSummary: _summary, ...step }) => step),
        }
      : null,
  };
}
