import { describe, expect, it } from 'bun:test';

import {
  FOLLOW_UP_OPTIONS,
  type FollowUpAnswer,
  classifyFollowUpAnswer,
  describesProblem,
  followUpQuestion,
} from '@/domain/policies/follow-up';

describe('classifyFollowUpAnswer', () => {
  it('reconhece os três botões', () => {
    expect(classifyFollowUpAnswer(FOLLOW_UP_OPTIONS.resolved)).toBe('RESOLVED');
    expect(classifyFollowUpAnswer(FOLLOW_UP_OPTIONS.newProblem)).toBe('NEW_PROBLEM');
    expect(classifyFollowUpAnswer(FOLLOW_UP_OPTIONS.continues)).toBe('CONTINUES');
  });

  it.each<[string, FollowUpAnswer]>([
    ['Não resolveu, ainda está lento', 'CONTINUES'],
    ['continua do mesmo jeito', 'CONTINUES'],
    ['é o mesmo problema', 'CONTINUES'],
    ['tenho outro problema agora', 'NEW_PROBLEM'],
    ['agora é outra coisa', 'NEW_PROBLEM'],
    ['sim, resolveu!', 'RESOLVED'],
    ['pode fechar', 'RESOLVED'],
    ['deu certo, obrigado', 'RESOLVED'],
  ])('"%s" → %s', (text, expected) => {
    expect(classifyFollowUpAnswer(text)).toBe(expected);
  });

  it('sem pista clara, devolve null (vira descrição de problema novo)', () => {
    expect(classifyFollowUpAnswer('meu mouse parou de funcionar')).toBeNull();
  });
});

describe('followUpQuestion', () => {
  it('pergunta pelo chamado atendido, com os três botões', () => {
    expect(followUpQuestion('INC-20311')).toEqual({
      type: 'QUICK_REPLIES',
      question: 'O atendimento do INC-20311 resolveu o seu problema?',
      options: [
        FOLLOW_UP_OPTIONS.resolved,
        FOLLOW_UP_OPTIONS.newProblem,
        FOLLOW_UP_OPTIONS.continues,
      ],
      answered: null,
    });
  });
});

describe('describesProblem', () => {
  it('só o botão pede a descrição; com o problema na mensagem, segue para o agent', () => {
    expect(describesProblem(FOLLOW_UP_OPTIONS.newProblem)).toBe(false);
    expect(describesProblem('tenho outro problema: o mouse parou de funcionar hoje')).toBe(true);
  });
});
