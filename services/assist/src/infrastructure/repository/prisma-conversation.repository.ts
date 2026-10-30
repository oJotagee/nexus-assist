import type { ConsoleFilter } from '@nexo/shared';
import { Injectable } from '@nestjs/common';

import { ConversationEntity } from '@/domain/entities/conversation.entity';
import type { ConversationModel } from '@generated/prisma/models';
import type { SessionRecord } from '@/domain/entities/message';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@generated/prisma/client';
import type {
  ConsoleListParams,
  ConversationRepository,
} from '@/application/ports/repositories.port';

const CONSOLE_PAGE_SIZE = 50;

function toDomain(row: ConversationModel): ConversationEntity {
  return ConversationEntity.restore({
    id: row.id,
    employeeId: row.employeeId,
    state: row.state,
    assignedAnalystId: row.assignedAnalystId,
    handoffReason: row.handoffReason,
    handoffSummary: row.handoffSummary,
    handoffGroup: row.handoffGroup,
    handoffAt: row.handoffAt,
    focusTicketId: row.focusTicketId,
    followUp: row.followUp,
    followUpTicketId: row.followUpTicketId,
    resolvedByAgent: row.resolvedByAgent,
    lastMessageAt: row.lastMessageAt,
    createdAt: row.createdAt,
  });
}

function filterWhere(filter: ConsoleFilter, analystId: string): Prisma.ConversationWhereInput {
  switch (filter) {
    case 'waiting':
      return { state: 'WAITING_ANALYST' };
    case 'agent':
      return { state: 'AGENT' };
    case 'mine':
      return { state: 'WITH_ANALYST', assignedAnalystId: analystId };
    case 'all':
      return {};
  }
}

@Injectable()
export class PrismaConversationRepository implements ConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ConversationEntity | null> {
    const row = await this.prisma.conversation.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findLatestByEmployee(employeeId: string): Promise<ConversationEntity | null> {
    const row = await this.prisma.conversation.findFirst({
      where: { employeeId },
      orderBy: { lastMessageAt: 'desc' },
    });
    return row ? toDomain(row) : null;
  }

  async create(conversation: ConversationEntity): Promise<void> {
    const data = conversation.toSnapshot();

    await this.prisma.conversation.create({
      data: { ...data, sessions: { create: { index: 0 } } },
    });
  }

  async save(conversation: ConversationEntity): Promise<void> {
    const { id, employeeId: _owner, createdAt: _created, ...data } = conversation.toSnapshot();
    await this.prisma.conversation.update({ where: { id }, data });
  }

  async currentSession(conversationId: string): Promise<SessionRecord> {
    return this.prisma.chatSession.findFirstOrThrow({
      where: { conversationId },
      orderBy: { index: 'desc' },
    });
  }

  async startSession(conversationId: string, summary: string | null): Promise<SessionRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.chatSession.findFirstOrThrow({
        where: { conversationId },
        orderBy: { index: 'desc' },
      });

      await tx.chatSession.update({ where: { id: current.id }, data: { endedAt: new Date() } });

      return tx.chatSession.create({
        data: { conversationId, index: current.index + 1, summary },
      });
    });
  }

  async listForConsole({
    filter,
    analystId,
    query,
  }: ConsoleListParams): Promise<ConversationEntity[]> {
    const search = query?.trim();

    const rows = await this.prisma.conversation.findMany({
      where: {
        ...filterWhere(filter, analystId),
        messages: { some: {} },
        ...(search
          ? {
              OR: [
                { employee: { name: { contains: search, mode: 'insensitive' } } },
                { focusTicketId: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { lastMessageAt: 'desc' },
      take: CONSOLE_PAGE_SIZE,
    });

    return rows.map(toDomain).sort((a, b) => {
      const waitingA = a.state === 'WAITING_ANALYST' ? 0 : 1;
      const waitingB = b.state === 'WAITING_ANALYST' ? 0 : 1;
      if (waitingA !== waitingB) return waitingA - waitingB;
      if (waitingA === 0) {
        return (
          (a.toSnapshot().handoffAt?.getTime() ?? 0) - (b.toSnapshot().handoffAt?.getTime() ?? 0)
        );
      }
      return 0;
    });
  }

  async countForConsole(analystId: string): Promise<Record<ConsoleFilter, number>> {
    const withMessages = { messages: { some: {} } };

    const [all, waiting, agent, mine] = await Promise.all([
      this.prisma.conversation.count({ where: withMessages }),
      this.prisma.conversation.count({
        where: { ...withMessages, ...filterWhere('waiting', analystId) },
      }),
      this.prisma.conversation.count({
        where: { ...withMessages, ...filterWhere('agent', analystId) },
      }),
      this.prisma.conversation.count({
        where: { ...withMessages, ...filterWhere('mine', analystId) },
      }),
    ]);

    return { all, waiting, agent, mine };
  }
}
