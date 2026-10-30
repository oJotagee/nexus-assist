import { type AgentIntent, type MessageBlock, type TraceStep, confidenceBand } from '@nexo/shared';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Agent } from '@mastra/core/agent';

import { TICKETS_GATEWAY, type TicketsGateway } from '@/application/ports/tickets-gateway.port';
import { ID_GENERATOR, type IdGenerator } from '@/application/ports/services.port';
import { SYSTEM_PROMPT, buildTurnContext } from './prompt';
import { type TurnState, createAgentTools } from './tools';
import { AGENT_MODEL, type AgentModel } from './model';
import { TurnRecorder } from './turn-recorder';
import {
  type AgentDecision,
  type AgentHistoryMessage,
  type AgentRunner,
  type AgentTurnInput,
  type AgentTurnResult,
  type AgentTurnSink,
  AgentUnavailableError,
} from '@/application/ports/agent.port';
import {
  DRAFT_REPOSITORY,
  type DraftRepository,
  HELP_ARTICLE_REPOSITORY,
  type HelpArticleRepository,
} from '@/application/ports/repositories.port';

const MAX_STEPS = 6;
/** Tempo máximo de um turno do agent; passado disso o chat mostra erro com "Tentar novamente". */
export const DEFAULT_AGENT_TURN_TIMEOUT_MS = Number(process.env.AGENT_TURN_TIMEOUT_MS ?? 45_000);
export const AGENT_TURN_TIMEOUT = Symbol('AGENT_TURN_TIMEOUT');
/** Uma repetição só: no plano gratuito, repetir um 429 com espera longa só deixava o chat preso. */
const MODEL_MAX_RETRIES = 1;
/** Mensagens da sessão enviadas ao modelo; o resto chega pelo resumo (custo por conversa). */
const HISTORY_WINDOW = 16;

type ModelMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
  providerOptions?: object;
};

@Injectable()
export class NexoAgentRunner implements AgentRunner {
  private readonly logger = new Logger(NexoAgentRunner.name);

  constructor(
    @Inject(AGENT_MODEL) private readonly model: AgentModel | null,
    @Inject(TICKETS_GATEWAY) private readonly tickets: TicketsGateway,
    @Inject(DRAFT_REPOSITORY) private readonly drafts: DraftRepository,
    @Inject(HELP_ARTICLE_REPOSITORY) private readonly articles: HelpArticleRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Optional() @Inject(AGENT_TURN_TIMEOUT) timeoutMs?: number,
  ) {
    this.timeoutMs = timeoutMs ?? DEFAULT_AGENT_TURN_TIMEOUT_MS;
  }

  private readonly timeoutMs: number;

  async run(input: AgentTurnInput, sink: AgentTurnSink): Promise<AgentTurnResult> {
    if (!this.model) {
      throw new AgentUnavailableError(
        'O assistente está sem modelo configurado (GOOGLE_GENERATIVE_AI_API_KEY). Fale com o service desk pelo ramal 4000.',
      );
    }

    const started = Date.now();
    const recorder = new TurnRecorder(sink);
    const state: TurnState = {
      decision: null,
      handoff: null,
      draft: null,
      focusTicketId: input.focusTicketId,
      ticketCache: null,
    };

    const agent = new Agent({
      id: 'nexo-assist',
      name: 'Nexo Assist',
      maxRetries: MODEL_MAX_RETRIES,
      instructions: {
        role: 'system',
        content: SYSTEM_PROMPT,
        providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
      },
      model: this.model.languageModel,
      tools: createAgentTools({
        employeeId: input.employee.id,
        conversationId: input.conversationId,
        now: input.now,
        recorder,
        state,
        deps: {
          tickets: this.tickets,
          drafts: this.drafts,
          articles: this.articles,
          ids: this.ids,
        },
      }),
    });

    const messages: ModelMessage[] = [
      { role: 'system', content: buildTurnContext(input) },
      ...input.history.slice(-HISTORY_WINDOW).flatMap(toModelMessage),
      { role: 'user', content: input.userMessage },
    ];

    let text = '';
    const deadline = AbortSignal.timeout(this.timeoutMs);
    try {
      const output = await agent.stream(messages as never, {
        maxSteps: MAX_STEPS,
        modelSettings: { maxOutputTokens: this.model.maxOutputTokens },
        providerOptions: this.model.providerOptions as never,
        abortSignal: deadline,
      });

      for await (const chunk of output.fullStream) {
        if (chunk.type === 'text-delta') {
          text += chunk.payload.text;
          sink.textDelta(chunk.payload.text);
        } else if (chunk.type === 'error') {
          throw toError(chunk.payload.error);
        }
      }

      if (deadline.aborted) throw deadline.reason;

      const usage = await output.totalUsage;

      const inline = recorder.blocks.some((block) => block.type === 'QUICK_REPLIES')
        ? null
        : extractInlineOptions(text);
      if (inline) {
        text = inline.text;
        sink.block(inline.block);
      }

      return {
        text,
        blocks: inline ? [...recorder.blocks, inline.block] : recorder.blocks,
        steps: recorder.steps,
        decision:
          state.decision ?? inferDecision(recorder.steps, recorder.blocks, input.userMessage),
        handoffRequest: state.handoff,
        draft: state.draft,
        focusTicketId: state.focusTicketId,
        usage: {
          model: this.model.id,
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          latencyMs: Date.now() - started,
        },
      };
    } catch (error) {
      if (error instanceof AgentUnavailableError) throw error;
      if (deadline.aborted || isTimeoutError(error)) {
        this.logger.warn(`Turno do agent passou de ${this.timeoutMs} ms.`);
        throw new AgentUnavailableError(
          'O assistente demorou demais para responder. Tente de novo ou peça para falar com um analista.',
        );
      }
      if (isQuotaError(error)) {
        this.logger.warn('Cota do modelo esgotada (plano gratuito do provedor).');
        throw new AgentUnavailableError(
          'O assistente atingiu o limite de uso do momento. Tente de novo em um minuto ou peça para falar com um analista.',
        );
      }
      this.logger.error(`Falha no turno do agent: ${error instanceof Error ? error.stack : error}`);
      throw new AgentUnavailableError(
        'Não consegui responder agora. Tente de novo em instantes ou peça para falar com um analista.',
      );
    }
  }
}

/**
 * Erros do provedor chegam pelo stream do Mastra como objeto simples (com statusCode e
 * responseBody), não como Error; normaliza para a detecção de cota e o log funcionarem.
 */
export function toError(payload: unknown): Error {
  if (payload instanceof Error) return payload;
  if (payload && typeof payload === 'object') {
    const details = payload as { message?: unknown; responseBody?: unknown; statusCode?: unknown };
    const message = [details.message, details.responseBody]
      .filter((part) => typeof part === 'string')
      .join(' ');
    return Object.assign(new Error(message || JSON.stringify(payload)), {
      statusCode: details.statusCode,
    });
  }
  return new Error(String(payload));
}

const INLINE_OPTIONS = /\[\s*op[çc][õo]es\s*:\s*([^\]]+)\]/i;

/**
 * Às vezes o modelo escreve as opções no texto ("Isso resolveu? [opções: Resolveu | Não
 * resolveu]") em vez de usar ask_quick_question. Vira o bloco de botões; a última pergunta do
 * texto vira a pergunta do bloco.
 */
export function extractInlineOptions(
  text: string,
): { text: string; block: Extract<MessageBlock, { type: 'QUICK_REPLIES' }> } | null {
  const match = text.match(INLINE_OPTIONS);
  if (!match) return null;

  const options = (match[1] ?? '')
    .split(/\s*[|;]\s*/)
    .map((option) => option.replace(/^["'“]|["'”]$/g, '').trim())
    .filter(Boolean)
    .slice(0, 5);
  if (options.length < 2) return null;

  const rest = text
    .replace(match[0], '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const question = rest.match(/[^.!?\n]*\?\s*$/)?.[0]?.trim();
  const remaining = question ? rest.slice(0, rest.length - question.length).trim() : rest;

  return {
    text: remaining,
    block: {
      type: 'QUICK_REPLIES',
      question: question || 'Escolha uma opção:',
      options,
      answered: null,
    },
  };
}

/** Turno abortado pelo tempo máximo (AbortSignal.timeout). */
export function isTimeoutError(error: unknown): boolean {
  const name = (error as { name?: unknown } | null)?.name;
  if (name === 'TimeoutError' || name === 'AbortError') return true;
  const text =
    error instanceof Error ? `${error.message} ${String(error.cause ?? '')}` : String(error);
  return /TimeoutError|aborted|timed out/i.test(text);
}

/** 429 / RESOURCE_EXHAUSTED: limite por minuto ou por dia do plano gratuito do provedor. */
export function isQuotaError(error: unknown): boolean {
  const status =
    (error as { statusCode?: unknown; status?: unknown } | null)?.statusCode ??
    (error as { status?: unknown } | null)?.status;
  if (status === 429) return true;
  const text =
    error instanceof Error ? `${error.message} ${String(error.cause ?? '')}` : String(error);
  return /\b429\b|RESOURCE_EXHAUSTED|quota|rate limit/i.test(text);
}

function toModelMessage(message: AgentHistoryMessage): ModelMessage[] {
  const blocks = describeBlocks(message.blocks);
  const text = blocks ? `${message.text}\n${blocks}` : message.text;

  switch (message.author) {
    case 'EMPLOYEE':
      return [{ role: 'user', content: message.text }];
    case 'AGENT':
      return [{ role: 'assistant', content: text }];
    case 'ANALYST':
      return [
        { role: 'assistant', content: `[Analista ${message.authorName ?? ''}] ${message.text}` },
      ];
    case 'SYSTEM':
      return [{ role: 'assistant', content: `[Evento do sistema] ${message.text}` }];
  }
}

/** Os cards não viram texto na conversa; uma linha curta mantém o modelo ciente do que foi mostrado. */
function describeBlocks(blocks: MessageBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'TICKET_CARD':
          return `[card do chamado ${block.ticket.id}: ${block.ticket.status}${block.ticket.overdue ? ', vencido' : ''}]`;
        case 'TICKET_PICKER':
          return `[lista para escolher: ${block.tickets.map((ticket) => ticket.id).join(', ')}${block.selectedId ? ` · escolhido ${block.selectedId}` : ''}]`;
        case 'DRAFT':
          return `[rascunho de chamado ${block.draftId}]`;
        case 'QUICK_REPLIES':
          return `(pergunta feita com ask_quick_question: "${block.question}"${block.answered ? `; o funcionário escolheu "${block.answered}"` : ''})`;
        case 'NOTICE':
          return `[aviso: ${block.text}]`;
        default:
          return '';
      }
    })
    .join('\n');
}

const INTENT_BY_TOOL: [string, AgentIntent, string][] = [
  ['draft.create', 'TICKET_CREATE', 'montou o rascunho'],
  ['tickets.get', 'TICKET_STATUS', 'mostrou o status do chamado'],
  ['ui.ticketPicker', 'TICKET_STATUS', 'pediu para escolher o chamado'],
  ['tickets.list', 'TICKET_STATUS', 'consultou os chamados'],
  ['help.search', 'FAQ', 'respondeu com a central de ajuda'],
];

/**
 * Se o modelo não registrar a decisão, ela é inferida dos passos executados, com segurança
 * média e marcada como inferida no trace (transparência sobre a própria transparência).
 */
export function inferDecision(
  steps: TraceStep[],
  blocks: MessageBlock[],
  userMessage: string,
): AgentDecision {
  const tools = new Set(steps.filter((step) => step.status !== 'FAILED').map((step) => step.tool));
  const match = INTENT_BY_TOOL.find(([tool]) => tools.has(tool));
  const asked = blocks.some((block) => block.type === 'QUICK_REPLIES');
  const intent: AgentIntent = match?.[1] ?? (asked ? 'CLARIFY' : 'SMALL_TALK');
  const score = 0.65;

  return {
    intent,
    understood: { summary: userMessage.slice(0, 200), entities: {} },
    action: { type: intent, label: match?.[2] ?? (asked ? 'pediu mais informações' : 'respondeu') },
    confidence: { score, band: confidenceBand(score) },
    rationale:
      'O modelo não registrou a decisão neste turno; intenção inferida a partir das ferramentas usadas.',
    rulesApplied: [],
    declaredByModel: false,
  };
}
