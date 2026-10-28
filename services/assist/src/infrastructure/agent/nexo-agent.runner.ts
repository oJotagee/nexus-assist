import { type AgentIntent, type MessageBlock, type TraceStep, confidenceBand } from '@nexo/shared';
import { Agent } from '@mastra/core/agent';
import { Inject, Injectable, Logger } from '@nestjs/common';

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
import { ID_GENERATOR, type IdGenerator } from '@/application/ports/services.port';
import { TICKETS_GATEWAY, type TicketsGateway } from '@/application/ports/tickets-gateway.port';
import { AGENT_MODEL, type AgentModel } from './model';
import { SYSTEM_PROMPT, buildTurnContext } from './prompt';
import { type TurnState, createAgentTools } from './tools';
import { TurnRecorder } from './turn-recorder';

const MAX_STEPS = 6;
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
  ) {}

  async run(input: AgentTurnInput, sink: AgentTurnSink): Promise<AgentTurnResult> {
    if (!this.model) {
      throw new AgentUnavailableError(
        'O assistente está sem modelo configurado (ANTHROPIC_API_KEY). Fale com o service desk pelo ramal 4000.',
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
      instructions: {
        role: 'system',
        content: SYSTEM_PROMPT,
        // Ferramentas + prompt de sistema são estáveis: ficam no cache de prompt.
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
    try {
      const output = await agent.stream(messages as never, {
        maxSteps: MAX_STEPS,
        modelSettings: { maxOutputTokens: this.model.maxOutputTokens },
        providerOptions: this.model.providerOptions as never,
      });

      for await (const chunk of output.fullStream) {
        if (chunk.type === 'text-delta') {
          text += chunk.payload.text;
          sink.textDelta(chunk.payload.text);
        } else if (chunk.type === 'error') {
          throw chunk.payload.error instanceof Error
            ? chunk.payload.error
            : new Error(String(chunk.payload.error));
        }
      }

      const usage = await output.totalUsage;

      return {
        text,
        blocks: recorder.blocks,
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
      this.logger.error(`Falha no turno do agent: ${error instanceof Error ? error.stack : error}`);
      throw new AgentUnavailableError(
        'Não consegui responder agora. Tente de novo em instantes ou peça para falar com um analista.',
      );
    }
  }
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
          return `[opções: ${block.options.join(' | ')}${block.answered ? ` · respondeu "${block.answered}"` : ''}]`;
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
