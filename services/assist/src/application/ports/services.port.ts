export const CLOCK = Symbol('CLOCK');
export const ID_GENERATOR = Symbol('ID_GENERATOR');
export const TOKEN_ISSUER = Symbol('TOKEN_ISSUER');

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

export type SessionTokenPayload = {
  sub: string;
  email: string;
  name: string;
  role: 'EMPLOYEE' | 'ANALYST';
};

export interface TokenIssuer {
  issue(payload: SessionTokenPayload): Promise<string>;
}
