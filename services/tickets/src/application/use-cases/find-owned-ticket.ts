import type { TicketEntity } from '@/domain/entities/ticket.entity';
import { TicketNotFoundError } from '@/domain/errors/ticket.error';
import type { TicketRepository } from '../ports/ticket-repository.port';

/** Busca o chamado garantindo que é do funcionário; caso contrário, "não encontrado". */
export async function findOwnedTicket(
  tickets: TicketRepository,
  employeeId: string,
  ticketId: string,
): Promise<TicketEntity> {
  const ticket = await tickets.findById(ticketId.toUpperCase());

  if (!ticket || !ticket.isOwnedBy(employeeId)) throw new TicketNotFoundError(ticketId);

  return ticket;
}
