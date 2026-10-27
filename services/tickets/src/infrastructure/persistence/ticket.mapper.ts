import type { TicketModel, TicketUpdateModel } from '@generated/prisma/models';

import { TicketEntity, type TicketUpdate } from '@/domain/entities/ticket.entity';

export class TicketMapper {
  static toDomain(ticket: TicketModel): TicketEntity {
    return TicketEntity.restore({
      id: ticket.id,
      type: ticket.type,
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      impact: ticket.impact,
      status: ticket.status,
      requesterId: ticket.requesterId,
      assignedGroup: ticket.assignedGroup,
      assigneeName: ticket.assigneeName,
      createdAt: ticket.createdAt,
      lastUpdateAt: ticket.lastUpdateAt,
      resolvedAt: ticket.resolvedAt,
    });
  }

  static toPersistence(ticket: TicketEntity): TicketModel {
    return ticket.toJSON();
  }

  static updateToDomain(update: TicketUpdateModel): TicketUpdate {
    return {
      kind: update.kind,
      author: update.author,
      authorName: update.authorName,
      body: update.body,
      createdAt: update.createdAt,
    };
  }
}
