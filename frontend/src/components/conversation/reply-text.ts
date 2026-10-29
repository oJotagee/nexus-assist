import type { MessageBlock } from '@nexo/shared';

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

/**
 * Texto da resposta do agent a exibir. Quando o texto é só a pergunta que já aparece no bloco de
 * opções rápidas, ele é omitido para a pergunta não aparecer duas vezes.
 */
export function visibleReplyText(text: string, blocks: MessageBlock[]): string {
  const question = blocks.find((block) => block.type === 'QUICK_REPLIES');
  if (question?.type === 'QUICK_REPLIES' && normalize(text) === normalize(question.question)) {
    return '';
  }
  return text;
}
