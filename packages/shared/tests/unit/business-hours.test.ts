import { describe, expect, it } from 'bun:test';

import { addBusinessMinutes, isBusinessTime } from '../../src/sla';

// 27/10/2026 é uma terça-feira. Todas as datas em horário de Brasília.
const at = (iso: string) => new Date(`${iso}-03:00`);

describe('addBusinessMinutes', () => {
  it('soma dentro do mesmo expediente', () => {
    expect(addBusinessMinutes(at('2026-10-27T10:00:00'), 240)).toEqual(at('2026-10-27T14:00:00'));
  });

  it('passa para o dia seguinte quando o expediente acaba', () => {
    expect(addBusinessMinutes(at('2026-10-27T16:00:00'), 240)).toEqual(at('2026-10-28T10:00:00'));
  });

  it('pula o fim de semana', () => {
    expect(addBusinessMinutes(at('2026-10-30T17:00:00'), 120)).toEqual(at('2026-11-02T09:00:00'));
  });

  it('começa a contar na segunda quando aberto no sábado', () => {
    expect(addBusinessMinutes(at('2026-10-31T10:00:00'), 60)).toEqual(at('2026-11-02T09:00:00'));
  });

  it('começa a contar às 8h quando aberto de madrugada', () => {
    expect(addBusinessMinutes(at('2026-10-27T06:00:00'), 60)).toEqual(at('2026-10-27T09:00:00'));
  });

  it('começa a contar no dia seguinte quando aberto depois das 18h', () => {
    expect(addBusinessMinutes(at('2026-10-27T19:30:00'), 30)).toEqual(at('2026-10-28T08:30:00'));
  });

  it('termina exatamente no fim do expediente', () => {
    expect(addBusinessMinutes(at('2026-10-27T17:00:00'), 60)).toEqual(at('2026-10-27T18:00:00'));
  });

  it('rejeita minutos negativos', () => {
    expect(() => addBusinessMinutes(at('2026-10-27T10:00:00'), -1)).toThrow(RangeError);
  });
});

describe('isBusinessTime', () => {
  it.each([
    ['2026-10-27T08:00:00', true],
    ['2026-10-27T17:59:00', true],
    ['2026-10-27T18:00:00', false],
    ['2026-10-27T07:59:00', false],
    ['2026-10-31T10:00:00', false],
  ])('%s → %p', (iso, expected) => {
    expect(isBusinessTime(at(iso))).toBe(expected);
  });
});
