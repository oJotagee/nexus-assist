export class MissingIdempotencyKeyError extends Error {
  constructor() {
    super('Escritas exigem o header Idempotency-Key.');
    this.name = 'MissingIdempotencyKeyError';
  }
}

export class IdempotencyKeyReuseError extends Error {
  constructor() {
    super('Esta Idempotency-Key já foi usada com outro conteúdo.');
    this.name = 'IdempotencyKeyReuseError';
  }
}

export class IdempotencyRequestInProgressError extends Error {
  constructor() {
    super('Uma requisição com esta Idempotency-Key ainda está em andamento. Tente de novo.');
    this.name = 'IdempotencyRequestInProgressError';
  }
}
