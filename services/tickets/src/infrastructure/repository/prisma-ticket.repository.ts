import type { TicketType } from '@nexo/shared';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '@generated/prisma/client';
import type { TicketScope, TicketRepository } from '@/application/ports/ticket-repository.port';
import type { TicketEntity, TicketUpdate } from '@/domain/entities/ticket.entity';
import { TicketMapper } from '../persistence/ticket.mapper';
import { PrismaService } from '../prisma/prisma.service';

const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const OPEN_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_ANALYST', 'WAITING_REQUESTER', 'APPROVED'];

@Injectable()
export class PrismaTicketRepository implements TicketRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<TicketEntity | null> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    return ticket ? TicketMapper.toDomain(ticket) : null;
  }

  async findByRequester(
    requesterId: string,
    scope: TicketScope,
    now: Date,
  ): Promise<TicketEntity[]> {
    const tickets = await this.prisma.ticket.findMany({
      where: { requesterId, ...this.scopeFilter(scope, now) },
      orderBy: { lastUpdateAt: 'desc' },
    });

    return tickets.map(TicketMapper.toDomain);
  }

  async findUpdates(ticketId: string): Promise<TicketUpdate[]> {
    const updates = await this.prisma.ticketUpdate.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });

    return updates.map(TicketMapper.updateToDomain);
  }

  async nextId(type: TicketType): Promise<string> {
    // UPDATE ... RETURNING é atômico: duas criações simultâneas nunca recebem o mesmo número.
    const sequence = await this.prisma.ticketSequence.update({
      where: { type },
      data: { next: { increment: 1 } },
    });

    return `${type}-${sequence.next - 1}`;
  }

  async save(ticket: TicketEntity, update: TicketUpdate): Promise<void> {
    const data = TicketMapper.toPersistence(ticket);

    await this.prisma.$transaction([
      this.prisma.ticket.upsert({ where: { id: data.id }, create: data, update: data }),
      this.prisma.ticketUpdate.create({ data: { ...update, ticketId: data.id } }),
    ]);
  }

  private scopeFilter(scope: TicketScope, now: Date): Prisma.TicketWhereInput {
    const open = { status: { in: OPEN_STATUSES } } as Prisma.TicketWhereInput;

    if (scope === 'open') return open;
    if (scope === 'all') return {};

    return {
      OR: [open, { lastUpdateAt: { gte: new Date(now.getTime() - RECENT_WINDOW_MS) } }],
    };
  }
}
