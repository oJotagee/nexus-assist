// Erros de domínio do assist. O DomainExceptionFilter traduz cada um para um status HTTP
// e o frontend mostra a `message` (formato { error, message } do booktattoo).

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Não encontramos esse e-mail corporativo.');
    this.name = 'InvalidCredentialsError';
  }
}

export class EmployeeNotFoundError extends Error {
  constructor() {
    super('Funcionário não encontrado.');
    this.name = 'EmployeeNotFoundError';
  }
}

export class ConversationNotFoundError extends Error {
  constructor() {
    super('Conversa não encontrada.');
    this.name = 'ConversationNotFoundError';
  }
}

export class InvalidConversationTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidConversationTransitionError';
  }
}

export class NotAssignedAnalystError extends Error {
  constructor() {
    super('Só o analista que assumiu a conversa pode responder.');
    this.name = 'NotAssignedAnalystError';
  }
}

export class SessionLimitReachedError extends Error {
  constructor(limit: number) {
    super(`Esta sessão chegou ao limite de ${limit} mensagens. Inicie uma nova sessão.`);
    this.name = 'SessionLimitReachedError';
  }
}

export class DraftNotFoundError extends Error {
  constructor() {
    super('Rascunho não encontrado.');
    this.name = 'DraftNotFoundError';
  }
}

export class DraftNotPendingError extends Error {
  constructor() {
    super('Este rascunho já foi confirmado ou cancelado.');
    this.name = 'DraftNotPendingError';
  }
}

export class InvalidDraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDraftError';
  }
}

export class TraceNotFoundError extends Error {
  constructor() {
    super('Detalhe da decisão não encontrado.');
    this.name = 'TraceNotFoundError';
  }
}

export class DailyBudgetExceededError extends Error {
  constructor() {
    super(
      'Você atingiu o limite diário de uso do assistente. Tente amanhã ou fale com um analista.',
    );
    this.name = 'DailyBudgetExceededError';
  }
}

// ── Sistema de chamados (legado) ─────────────────────────────

export class TicketsUnavailableError extends Error {
  constructor() {
    super('O sistema de chamados está instável agora. Tente de novo em instantes.');
    this.name = 'TicketsUnavailableError';
  }
}

export class TicketNotFoundError extends Error {
  constructor(id: string) {
    super(`Não encontrei o chamado ${id} entre os seus.`);
    this.name = 'TicketNotFoundError';
  }
}

export class TicketConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TicketConflictError';
  }
}
