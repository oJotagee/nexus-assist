import type { TicketType } from '@nexo/shared';

import type { Clock } from '@/application/ports/clock.port';
import type {
  ClaimResult,
  IdempotencyStore,
  StoredResponse,
} from '@/application/ports/idempotency-store.port';
import type { TicketRepository, TicketScope } from '@/application/ports/ticket-repository.port';
import type { TicketEntity, TicketUpdate } from '@/domain/entities/ticket.entity';

export class InMemoryTicketRepository implements TicketRepository {
  readonly tickets = new Map<string, TicketEntity>();
  readonly updates = new Map<string, TicketUpdate[]>();
  private readonly sequences: Record<TicketType, number> = { INC: 20341, REQ: 10502 };

  seed(...tickets: TicketEntity[]): this {
    for (const ticket of tickets) this.tickets.set(ticket.id, ticket);
    return this;
  }

  async findById(id: string): Promise<TicketEntity | null> {
    return this.tickets.get(id) ?? null;
  }

  async findByRequester(requesterId: string, scope: TicketScope): Promise<TicketEntity[]> {
    return [...this.tickets.values()]
      .filter((ticket) => ticket.requesterId === requesterId)
      .filter((ticket) => scope !== 'open' || ticket.isOpen());
  }

  async findUpdates(ticketId: string): Promise<TicketUpdate[]> {
    return this.updates.get(ticketId) ?? [];
  }

  async nextId(type: TicketType): Promise<string> {
    const next = this.sequences[type];
    this.sequences[type] = next + 1;
    return `${type}-${next}`;
  }

  async save(ticket: TicketEntity, update: TicketUpdate): Promise<void> {
    this.tickets.set(ticket.id, ticket);
    this.updates.set(ticket.id, [...(this.updates.get(ticket.id) ?? []), update]);
  }
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  readonly records = new Map<string, StoredResponse>();

  async claim(key: string, requestHash: string): Promise<ClaimResult> {
    const existing = this.records.get(key);
    if (existing) return { claimed: false, existing: { ...existing } };
    this.records.set(key, { requestHash, statusCode: null, response: null });
    return { claimed: true };
  }

  async find(key: string): Promise<StoredResponse | null> {
    const record = this.records.get(key);
    return record ? { ...record } : null;
  }

  async complete(key: string, statusCode: number, response: unknown): Promise<void> {
    const record = this.records.get(key);
    if (record) this.records.set(key, { ...record, statusCode, response });
  }

  async release(key: string): Promise<void> {
    if (this.records.get(key)?.statusCode === null) this.records.delete(key);
  }
}

export class FixedClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }

  set(date: Date): void {
    this.current = date;
  }
}
