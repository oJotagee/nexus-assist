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
