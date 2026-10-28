export const IDEMPOTENCY_STORE = Symbol('IDEMPOTENCY_STORE');

export type StoredResponse = {
  requestHash: string;
  /** null enquanto a primeira requisição com a chave ainda está executando. */
  statusCode: number | null;
  response: unknown;
};

export type ClaimResult = { claimed: true } | { claimed: false; existing: StoredResponse };

export interface IdempotencyStore {
  /** Reserva a chave de forma atômica; só quem reserva executa a escrita. */
  claim(key: string, requestHash: string): Promise<ClaimResult>;
  find(key: string): Promise<StoredResponse | null>;
  complete(key: string, statusCode: number, response: unknown): Promise<void>;
  /** Libera a reserva quando a escrita falhou, para uma nova tentativa poder executar. */
  release(key: string): Promise<void>;
}
