import type {
  DraftMode,
  TicketCategory,
  TicketImpact,
  TicketPriority,
  TicketType,
} from '@nexo/shared';
import { Injectable } from '@nestjs/common';

import type { TicketDraftModel } from '@generated/prisma/models';
import type { DraftRepository } from '@/application/ports/repositories.port';
import { TicketDraftEntity } from '@/domain/entities/ticket-draft.entity';
import { PrismaService } from '../prisma/prisma.service';

function toDomain(row: TicketDraftModel): TicketDraftEntity {
  return TicketDraftEntity.restore({
    id: row.id,
    conversationId: row.conversationId,
    mode: row.mode as DraftMode,
    targetTicketId: row.targetTicketId,
    type: row.type as TicketType,
    title: row.title,
    description: row.description,
    category: row.category as TicketCategory,
    priority: row.priority as TicketPriority,
    priorityRule: row.priorityRule,
    impact: row.impact as TicketImpact,
    dueAt: row.dueAt,
    status: row.status,
    idempotencyKey: row.idempotencyKey,
    resultTicketId: row.resultTicketId,
  });
}

@Injectable()
export class PrismaDraftRepository implements DraftRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<TicketDraftEntity | null> {
    const row = await this.prisma.ticketDraft.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findPending(conversationId: string): Promise<TicketDraftEntity | null> {
    const row = await this.prisma.ticketDraft.findFirst({
      where: { conversationId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    return row ? toDomain(row) : null;
  }

  async listByConversation(conversationId: string): Promise<TicketDraftEntity[]> {
    const rows = await this.prisma.ticketDraft.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDomain);
  }

  async save(draft: TicketDraftEntity): Promise<void> {
    const data = draft.toSnapshot();
    await this.prisma.ticketDraft.upsert({ where: { id: data.id }, create: data, update: data });
  }
}
