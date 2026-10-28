export class InvalidTicketError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTicketError';
  }
}

export class TicketNotFoundError extends Error {
  constructor(id: string) {
    super(`Chamado ${id} não encontrado.`);
    this.name = 'TicketNotFoundError';
  }
}

export class TicketClosedError extends Error {
  constructor(id: string) {
    super(`O chamado ${id} já foi encerrado. Reabra o chamado ou abra um novo.`);
    this.name = 'TicketClosedError';
  }
}

export class TicketCannotBeReopenedError extends Error {
  constructor(id: string) {
    super(`O chamado ${id} não pode ser reaberto: só chamados resolvidos há até 7 dias.`);
    this.name = 'TicketCannotBeReopenedError';
  }
}
