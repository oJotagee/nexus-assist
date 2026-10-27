export const IDEMPOTENCY_STORE = Symbol('IDEMPOTENCY_STORE');

export type StoredResponse = {
  requestHash: string;
  statusCode: number;
  response: unknown;
};

export interface IdempotencyStore {
  find(key: string): Promise<StoredResponse | null>;
  /** Retorna false se outra requisição gravou a mesma chave antes (corrida). */
  save(key: string, stored: StoredResponse): Promise<boolean>;
}
