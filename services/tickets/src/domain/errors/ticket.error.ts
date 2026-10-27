export class InvalidTicketError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTicketError';
  }
}

// Também é usado quando o chamado existe mas é de outra pessoa: não confirmar a
// existência de chamados alheios faz parte da regra de privacidade.
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
