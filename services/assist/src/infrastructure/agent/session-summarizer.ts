import { Agent } from '@mastra/core/agent';
import { Inject, Injectable, Logger } from '@nestjs/common';

import type { SessionSummarizer } from '@/application/use-cases/conversation/start-new-session.use-case';
import { AGENT_MODEL, type AgentModel } from './model';

const SUMMARY_PROMPT =
  'Resuma em até 4 frases, em português, esta conversa de service desk de TI para dar contexto à próxima sessão: o problema, chamados citados (com número), o que já foi feito e o que ficou pendente. Sem saudações.';

/**
 * Resume a sessão que acabou (limite de 30 mensagens). A próxima sessão recebe só o resumo,
 * o que mantém o contexto e corta o custo de reenviar o histórico inteiro.
 */
@Injectable()
export class LlmSessionSummarizer implements SessionSummarizer {
  private readonly logger = new Logger(LlmSessionSummarizer.name);

  constructor(@Inject(AGENT_MODEL) private readonly model: AgentModel | null) {}

  async summarize(messages: { author: string; text: string }[]): Promise<string | null> {
    const transcript = messages
      .filter(
        (message) =>
          message.author === 'EMPLOYEE' ||
          message.author === 'AGENT' ||
          message.author === 'ANALYST',
      )
      .map(
        (message) =>
          `${message.author === 'EMPLOYEE' ? 'Funcionário' : message.author === 'AGENT' ? 'Assistente' : 'Analista'}: ${message.text}`,
      )
      .join('\n');

    if (!transcript) return null;
    if (!this.model) return extractiveSummary(messages);

    try {
      const agent = new Agent({
        id: 'nexo-session-summarizer',
        name: 'Resumo de sessão',
        instructions: SUMMARY_PROMPT,
        model: this.model.languageModel,
      });
      const result = await agent.generate(transcript, {
        modelSettings: { maxOutputTokens: 400 },
        providerOptions: { anthropic: { effort: 'low' } } as never,
      });
      return result.text.trim() || extractiveSummary(messages);
    } catch (error) {
      this.logger.warn(`Resumo da sessão falhou, usando resumo simples: ${String(error)}`);
      return extractiveSummary(messages);
    }
  }
}

/** Sem modelo: últimas falas do funcionário e chamados citados. */
export function extractiveSummary(messages: { author: string; text: string }[]): string | null {
  const said = messages
    .filter((message) => message.author === 'EMPLOYEE')
    .slice(-3)
    .map((message) => message.text.slice(0, 160));
  const tickets = [
    ...new Set(messages.flatMap((message) => message.text.match(/\b(INC|REQ)-\d+\b/g) ?? [])),
  ];

  if (said.length === 0) return null;

  return `Na sessão anterior o funcionário disse: ${said.join(' / ')}.${tickets.length ? ` Chamados citados: ${tickets.join(', ')}.` : ''}`;
}
