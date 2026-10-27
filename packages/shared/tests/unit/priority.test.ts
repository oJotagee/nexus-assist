import { describe, expect, it } from 'bun:test';

import { type PriorityInput, classifyPriority } from '../../src/sla';

const incident = (overrides: Partial<PriorityInput>): PriorityInput => ({
  type: 'INC',
  impact: 'SELF',
  blocksWork: false,
  sameDayCommitment: false,
  ...overrides,
});

describe('classifyPriority', () => {
  it('Crítica quando algo está parado para a empresa', () => {
    expect(classifyPriority(incident({ impact: 'COMPANY', blocksWork: true })).priority).toBe(
      'CRITICAL',
    );
  });

  it('Crítica quando algo está parado para uma equipe', () => {
    expect(classifyPriority(incident({ impact: 'TEAM', blocksWork: true })).priority).toBe(
      'CRITICAL',
    );
  });

  it('Alta quando a equipe é afetada mas consegue trabalhar', () => {
    expect(classifyPriority(incident({ impact: 'TEAM' })).priority).toBe('HIGH');
  });

  it('Alta quando há reunião no mesmo dia (VPN erro 809 no Windows 11)', () => {
    const decision = classifyPriority(incident({ sameDayCommitment: true }));

    expect(decision.priority).toBe('HIGH');
    expect(decision.rule).toContain('compromisso no mesmo dia');
  });

  it('Alta quando impede a pessoa de trabalhar', () => {
    expect(classifyPriority(incident({ blocksWork: true })).priority).toBe('HIGH');
  });

  it('Média quando atrapalha mas há alternativa (notebook lento)', () => {
    expect(classifyPriority(incident({})).priority).toBe('MEDIUM');
  });

  it('Baixa para pedidos sem urgência (segundo monitor)', () => {
    expect(classifyPriority(incident({ type: 'REQ' })).priority).toBe('LOW');
  });

  it('Média para pedido com compromisso no mesmo dia', () => {
    expect(classifyPriority(incident({ type: 'REQ', sameDayCommitment: true })).priority).toBe(
      'MEDIUM',
    );
  });

  it('sempre devolve a regra aplicada para o trace', () => {
    expect(classifyPriority(incident({})).rule.length).toBeGreaterThan(0);
  });
});
