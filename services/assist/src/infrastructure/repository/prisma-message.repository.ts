import type { AgentIntent, ConfidenceBand, MessageBlock, TraceStep } from '@nexo/shared';
import { Injectable } from '@nestjs/common';

import type { DecisionTraceRecord, MessageRecord, NewMessage } from '@/domain/entities/message';
import type { DecisionTraceModel, MessageModel } from '@generated/prisma/models';
import type { MessageRepository } from '@/application/ports/repositories.port';
import { countsTowardSessionLimit } from '@/domain/policies/session-limit';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@generated/prisma/client';

function toMessage(row: MessageModel): MessageRecord {
  return {
    id: row.id,
    conversationId: row.conversationId,
    sessionId: row.sessionId,
    author: row.author,
    authorId: row.authorId,
    authorName: row.authorName,
    text: row.text,
    blocks: row.blocks as MessageBlock[],
    createdAt: row.createdAt,
  };
}

function toTrace(row: DecisionTraceModel): DecisionTraceRecord {
  return {
    intent: row.intent as AgentIntent,
    understood: row.understood as DecisionTraceRecord['understood'],
    action: row.action as DecisionTraceRecord['action'],
    confidenceScore: row.confidenceScore,
    confidenceBand: row.confidenceBand as ConfidenceBand,
    rationale: row.rationale,
    rulesApplied: row.rulesApplied,
    steps: row.steps as TraceStep[],
    model: row.model,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    latencyMs: row.latencyMs,
  };
}

const json = (value: unknown) => value as Prisma.InputJsonValue;

@Injectable()
export class PrismaMessageRepository implements MessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async append(message: NewMessage, trace?: DecisionTraceRecord): Promise<MessageRecord> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.chatSession.findFirstOrThrow({
        where: { conversationId: message.conversationId },
        orderBy: { index: 'desc' },
      });

      const row = await tx.message.create({
        data: {
          conversationId: message.conversationId,
          sessionId: session.id,
          author: message.author,
          authorId: message.authorId,
          authorName: message.authorName,
          text: message.text,
          blocks: json(message.blocks),
          ...(trace
            ? {
                trace: {
                  create: {
                    ...trace,
                    understood: json(trace.understood),
                    action: json(trace.action),
                    steps: json(trace.steps),
                  },
                },
              }
            : {}),
        },
      });

      await Promise.all([
        countsTowardSessionLimit(message.author)
          ? tx.chatSession.update({
              where: { id: session.id },
              data: { messageCount: { increment: 1 } },
            })
          : null,
        tx.conversation.update({
          where: { id: message.conversationId },
          data: { lastMessageAt: row.createdAt },
        }),
      ]);

      return toMessage(row);
    });
  }

  async listByConversation(conversationId: string): Promise<MessageRecord[]> {
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toMessage);
  }

  async listBySession(sessionId: string): Promise<MessageRecord[]> {
    const rows = await this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toMessage);
  }

  async lastByConversations(conversationIds: string[]): Promise<Map<string, MessageRecord>> {
    if (conversationIds.length === 0) return new Map();

    const rows = await this.prisma.message.findMany({
      where: { conversationId: { in: conversationIds } },
      orderBy: { createdAt: 'desc' },
      distinct: ['conversationId'],
    });
    return new Map(rows.map((row) => [row.conversationId, toMessage(row)]));
  }

  async findById(id: string): Promise<MessageRecord | null> {
    const row = await this.prisma.message.findUnique({ where: { id } });
    return row ? toMessage(row) : null;
  }

  async updateBlocks(messageId: string, blocks: MessageBlock[]): Promise<void> {
    await this.prisma.message.update({ where: { id: messageId }, data: { blocks: json(blocks) } });
  }

  async findTrace(messageId: string): Promise<DecisionTraceRecord | null> {
    const row = await this.prisma.decisionTrace.findUnique({ where: { messageId } });
    return row ? toTrace(row) : null;
  }

  async findTraces(messageIds: string[]): Promise<Map<string, DecisionTraceRecord>> {
    if (messageIds.length === 0) return new Map();

    const rows = await this.prisma.decisionTrace.findMany({
      where: { messageId: { in: messageIds } },
    });
    return new Map(rows.map((row) => [row.messageId, toTrace(row)]));
  }

  async sumTokensSince(employeeId: string, since: Date): Promise<number> {
    const result = await this.prisma.decisionTrace.aggregate({
      where: { createdAt: { gte: since }, message: { conversation: { employeeId } } },
      _sum: { inputTokens: true, outputTokens: true },
    });
    return (result._sum.inputTokens ?? 0) + (result._sum.outputTokens ?? 0);
  }
}
