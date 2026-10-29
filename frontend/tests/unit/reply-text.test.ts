import { describe, expect, it } from 'bun:test';
import type { MessageBlock } from '@nexo/shared';

import { visibleReplyText } from '../../src/components/conversation/reply-text';

const quick: MessageBlock = {
  type: 'QUICK_REPLIES',
  question: 'Quem está sendo afetado?',
  options: ['Só eu', 'Minha equipe'],
  answered: null,
};

describe('visibleReplyText', () => {
  it('omite o texto que só repete a pergunta das opções', () => {
    expect(visibleReplyText('Quem está sendo afetado?', [quick])).toBe('');
    expect(visibleReplyText('quem esta sendo afetado', [quick])).toBe('');
  });

  it('mantém o texto com contexto além da pergunta', () => {
    const text = 'O artigo do erro 809 vale só para Windows 10. Quem está sendo afetado?';
    expect(visibleReplyText(text, [quick])).toBe(text);
  });

  it('sem opções rápidas, mostra o texto como veio', () => {
    expect(visibleReplyText('Quem está sendo afetado?', [])).toBe('Quem está sendo afetado?');
  });
});
