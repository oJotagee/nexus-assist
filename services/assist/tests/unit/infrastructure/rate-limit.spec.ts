import { describe, expect, it } from 'bun:test';

import { rateLimitTracker } from '@/infrastructure/config/rate-limit';

const tokenFor = (payload: object) =>
  `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

describe('rateLimitTracker', () => {
  it('conta por funcionário quando há token', () => {
    expect(
      rateLimitTracker({
        headers: { authorization: `Bearer ${tokenFor({ sub: 'emp_ana' })}` },
        ip: '10.0.0.1',
      }),
    ).toBe('user:emp_ana');
  });

  it('sem token, usa o IP real repassado pelo frontend', () => {
    expect(
      rateLimitTracker({ headers: { 'x-forwarded-for': '200.1.2.3, 10.0.0.1' }, ip: '10.0.0.1' }),
    ).toBe('ip:200.1.2.3');
  });

  it('token malformado cai no IP da conexão', () => {
    expect(rateLimitTracker({ headers: { authorization: 'Bearer lixo' }, ip: '10.0.0.9' })).toBe(
      'ip:10.0.0.9',
    );
  });
});
