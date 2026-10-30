import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  AGENT_INTENTS,
  type HandoffReason,
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABEL,
  TICKET_IMPACTS,
  TICKET_PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
  type TicketDraftDto,
  classifyPriority,
  confidenceBand,
  formatDueAt,
} from '@nexo/shared';

import type { DraftRepository, HelpArticleRepository } from '@/application/ports/repositories.port';
import type { Ticket, TicketsGateway } from '@/application/ports/tickets-gateway.port';
import { TicketDraftEntity } from '@/domain/entities/ticket-draft.entity';
import { toDraftDto, toTicketSummary } from '@/application/presenters';
import type { IdGenerator } from '@/application/ports/services.port';
import { findDuplicate } from '@/domain/policies/duplicate-detector';
import type { AgentDecision } from '@/application/ports/agent.port';
import { TicketNotFoundError } from '@/domain/errors/domain.error';
import { searchHelpArticles } from '@/domain/policies/help-search';
import type { TurnRecorder } from './turn-recorder';

export type ToolDependencies = {
  tickets: TicketsGateway;
  drafts: DraftRepository;
  articles: HelpArticleRepository;
  ids: IdGenerator;
};

/** Estado do turno, preenchido pelas tools e lido pelo runner ao final. */
export type TurnState = {
  decision: AgentDecision | null;
  handoff: { reason: HandoffReason; summary: string } | null;
  draft: TicketDraftDto | null;
  focusTicketId: string | null;
  ticketCache: Ticket[] | null;
};

type TurnContext = {
  employeeId: string;
  conversationId: string;
  now: Date;
  recorder: TurnRecorder;
  state: TurnState;
  deps: ToolDependencies;
};

const HANDOFF_REASONS = ['USER_REQUESTED', 'CRITICAL', 'OVERDUE', 'LOW_CONFIDENCE'] as const;

function compact(ticket: Ticket, now: Date) {
  return {
    id: ticket.id,
    title: ticket.title,
    status: TICKET_STATUS_LABEL[ticket.status],
    category: TICKET_CATEGORY_LABEL[ticket.category],
    priority: TICKET_PRIORITY_LABEL[ticket.priority],
    lastUpdate: ticket.lastUpdateAt.toISOString(),
    daysSinceUpdate: Math.floor((now.getTime() - ticket.lastUpdateAt.getTime()) / 86_400_000),
    sla: ticket.deadline.slaLabel,
    dueAt: ticket.deadline.dueAt ? formatDueAt(ticket.deadline.dueAt, now) : null,
    overdue: ticket.deadline.overdue,
    canReopen: ticket.canReopen,
  };
}

/**
 * Tools do agent, criadas por turno. O funcionário vem do contexto autenticado (closure),
 * nunca dos argumentos do modelo: é impossível o agent consultar chamados de outra pessoa.
 */
export function createAgentTools(ctx: TurnContext) {
  const { recorder, state, deps, employeeId, now } = ctx;

  async function myTickets(): Promise<{ tickets: Ticket[]; attempts: number }> {
    if (state.ticketCache) return { tickets: state.ticketCache, attempts: 1 };
    const { data, attempts } = await deps.tickets.list(employeeId, 'recent');
    state.ticketCache = data;
    return { tickets: data, attempts };
  }

  const searchHelpCenter = createTool({
    id: 'search_help_center',
    description:
      'Busca artigos da central de ajuda de TI. Use para dúvidas e antes de abrir chamado, para ver se há solução documentada.',
    inputSchema: z.object({ query: z.string().min(2).describe('Termos da dúvida ou do problema') }),
    execute: async ({ query }) =>
      recorder.step('help.search', 'buscou na central de ajuda', { query }, async () => {
        const hits = searchHelpArticles(await deps.articles.findAll(), query);
        return {
          summary: hits.length
            ? hits.map((hit) => `${hit.article.title} (${hit.score})`).join('; ')
            : 'nenhum artigo encontrado',
          result: {
            articles: hits.map((hit) => ({
              id: hit.article.id,
              title: hit.article.title,
              body: hit.article.body,
            })),
          },
        };
      }),
  });

  const listMyTickets = createTool({
    id: 'list_my_tickets',
    description:
      'Lista os chamados do funcionário (abertos e resolvidos nos últimos 30 dias), com status, prazo e se está vencido.',
    inputSchema: z.object({
      onlyOpen: z.boolean().default(true).describe('true para só os que ainda estão na fila'),
    }),
    execute: async ({ onlyOpen }) =>
      recorder.step('tickets.list', 'consultou seus chamados', { onlyOpen }, async () => {
        const { tickets, attempts } = await myTickets();
        const visible = onlyOpen
          ? tickets.filter((ticket) => ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED')
          : tickets;
        return {
          attempts,
          summary: `${visible.length} chamado(s): ${visible.map((ticket) => ticket.id).join(', ') || '—'}`,
          result: { tickets: visible.map((ticket) => compact(ticket, now)) },
        };
      }),
  });

  const showTicketPicker = createTool({
    id: 'show_ticket_picker',
    description:
      'Mostra ao funcionário uma lista dos chamados indicados para ele escolher um. Use quando houver mais de um candidato.',
    inputSchema: z.object({ ticketIds: z.array(z.string()).min(2).max(6) }),
    execute: async ({ ticketIds }) =>
      recorder.step(
        'ui.ticketPicker',
        'mostrou seus chamados para escolher',
        { ticketIds },
        async () => {
          const { tickets } = await myTickets();
          const selected = tickets.filter((ticket) => ticketIds.includes(ticket.id));
          recorder.block({
            type: 'TICKET_PICKER',
            tickets: selected.map(toTicketSummary),
            selectedId: null,
          });
          return {
            summary: selected.map((ticket) => ticket.id).join(', '),
            result: { shown: selected.length },
          };
        },
      ),
  });

  const getMyTicket = createTool({
    id: 'get_my_ticket',
    description:
      'Detalhe de um chamado do funcionário (status, prazo, histórico). Também mostra o card do chamado na tela.',
    inputSchema: z.object({ ticketId: z.string().describe('Ex.: INC-20311 ou REQ-10442') }),
    execute: async ({ ticketId }) => {
      const id = ticketId.trim().toUpperCase();
      const outcome = await recorder.step(
        'tickets.get',
        `consultou o ${id}`,
        { ticketId: id },
        async () => {
          const { data, attempts } = await deps.tickets.get(employeeId, id);
          state.focusTicketId = data.id;
          recorder.block({ type: 'TICKET_CARD', ticket: toTicketSummary(data) });
          return {
            attempts,
            summary: `${TICKET_STATUS_LABEL[data.status]}${data.deadline.overdue ? ', prazo vencido' : ''}`,
            result: {
              ...compact(data, now),
              description: data.description,
              assignedGroup: data.assignedGroup,
              assignee: data.assigneeName,
              recentUpdates: data.updates.slice(-5).map((update) => ({
                when: update.createdAt.toISOString(),
                author: update.authorName ?? update.author,
                text: update.body,
              })),
            },
          };
        },
      );

      if (!('error' in outcome)) {
        recorder.note(
          'sla.deadline',
          'calculou o prazo',
          outcome.overdue
            ? `vencido (prazo de ${outcome.sla})`
            : `em dia (prazo de ${outcome.sla})`,
        );
      }
      return outcome;
    },
  });

  const askQuickQuestion = createTool({
    id: 'ask_quick_question',
    description:
      'Faz uma pergunta com opções rápidas clicáveis (2 a 5, curtas). O funcionário também pode responder digitando.',
    inputSchema: z.object({
      question: z.string().min(3),
      options: z.array(z.string().min(1).max(40)).min(2).max(5),
    }),
    execute: async ({ question, options }) => {
      recorder.block({ type: 'QUICK_REPLIES', question, options, answered: null });
      return { shown: true, note: 'Não repita as opções no texto; faça só a pergunta.' };
    },
  });

  const draftTicket = createTool({
    id: 'draft_ticket',
    description:
      'Monta (ou substitui) o rascunho de chamado que o funcionário confirma na tela. Verifica duplicidade e calcula prioridade e prazo. NÃO cria o chamado.',
    inputSchema: z.object({
      type: z
        .enum(['INC', 'REQ'])
        .describe('INC: algo parou/não funciona. REQ: pedido de acesso, equipamento ou software'),
      title: z
        .string()
        .min(5)
        .max(120)
        .describe('Título objetivo, ex.: "VPN não conecta no notebook — erro 809"'),
      description: z
        .string()
        .min(10)
        .max(2000)
        .describe(
          'Para o analista: o que acontece, desde quando, o que já foi tentado, ambiente, impacto',
        ),
      category: z.enum(TICKET_CATEGORIES),
      impact: z
        .enum(TICKET_IMPACTS)
        .describe('SELF: só o funcionário · TEAM: a equipe · COMPANY: a empresa'),
      blocksWork: z.boolean().describe('Impede de trabalhar, sem alternativa'),
      sameDayCommitment: z.boolean().describe('Há compromisso hoje que depende disso'),
      mode: z
        .enum(['CREATE', 'UPDATE'])
        .default('CREATE')
        .describe('UPDATE para complementar um chamado aberto'),
      targetTicketId: z.string().optional().describe('Obrigatório em UPDATE'),
    }),
    execute: async (input) => {
      const repeated = state.draft;
      if (
        repeated &&
        repeated.title === input.title.trim() &&
        repeated.category === input.category &&
        repeated.type === input.type
      ) {
        return {
          draftId: repeated.id,
          mode: repeated.mode,
          targetTicketId: repeated.targetTicketId,
          priority: TICKET_PRIORITY_LABEL[repeated.priority],
          priorityRule: repeated.priorityRule,
          responseDue: formatDueAt(new Date(repeated.dueAt), now),
          note: 'Este rascunho já foi montado neste turno e está na tela. Não chame draft_ticket de novo; escreva a resposta final.',
        };
      }

      let target: { ticketId: string; mode: 'UPDATE' | 'REOPEN'; reason: string } | null = null;

      if (input.mode === 'UPDATE' && input.targetTicketId) {
        target = {
          ticketId: input.targetTicketId.toUpperCase(),
          mode: 'UPDATE',
          reason: 'Complemento pedido pelo funcionário.',
        };
      } else {
        const check = await recorder.step(
          'tickets.duplicates',
          'verificou duplicidade',
          { category: input.category },
          async () => {
            const { tickets, attempts } = await myTickets();
            const match = findDuplicate(input, tickets);
            return { attempts, summary: match?.reason ?? 'nenhum chamado parecido', result: match };
          },
        );
        if (check && !('error' in check)) target = check;
      }

      if (target && !(state.ticketCache ?? []).some((ticket) => ticket.id === target.ticketId)) {
        try {
          await deps.tickets.get(employeeId, target.ticketId);
        } catch (error) {
          if (error instanceof TicketNotFoundError) {
            return {
              error: `O chamado ${target.ticketId} não está entre os chamados do funcionário.`,
            };
          }
          throw error;
        }
      }

      const priority = classifyPriority(input);
      recorder.note('sla.priority', 'classificou a prioridade', priority.rule, {
        impact: input.impact,
        blocksWork: input.blocksWork,
        sameDayCommitment: input.sameDayCommitment,
      });

      const previous = await deps.drafts.findPending(ctx.conversationId);
      if (previous) await deps.drafts.save(previous.cancel());

      const draft = TicketDraftEntity.create(
        {
          id: deps.ids.next(),
          conversationId: ctx.conversationId,
          mode: target?.mode ?? 'CREATE',
          targetTicketId: target?.ticketId ?? null,
          type: input.type,
          title: input.title,
          description: input.description,
          category: input.category,
          priority: priority.priority,
          priorityRule: priority.rule,
          impact: input.impact,
          idempotencyKey: deps.ids.next(),
        },
        now,
      );
      await deps.drafts.save(draft);

      const dto = toDraftDto(draft);
      const due = formatDueAt(new Date(dto.dueAt), now);
      recorder.note('sla.deadline', 'consultou o SLA', `resposta até ${due}`);
      recorder.note(
        'draft.create',
        'montou o rascunho',
        `${dto.mode}${dto.targetTicketId ? ` de ${dto.targetTicketId}` : ''}`,
      );
      recorder.block({ type: 'DRAFT', draftId: dto.id });
      state.draft = dto;
      if (dto.targetTicketId) state.focusTicketId = dto.targetTicketId;

      return {
        draftId: dto.id,
        mode: dto.mode,
        targetTicketId: dto.targetTicketId,
        duplicateReason: target?.reason ?? null,
        priority: TICKET_PRIORITY_LABEL[dto.priority],
        priorityRule: dto.priorityRule,
        responseDue: due,
        note: 'O rascunho já aparece na tela com Confirmar/Editar/Cancelar. Explique a prioridade em uma frase e peça para conferir e confirmar.',
      };
    },
  });

  const requestHandoff = createTool({
    id: 'request_handoff',
    description:
      'Transfere a conversa para um analista (o agent fica pausado). Use quando o funcionário pedir, em casos críticos, chamado vencido com aceite do funcionário, ou quando você não tiver segurança.',
    inputSchema: z.object({
      reason: z.enum(HANDOFF_REASONS),
      summary: z
        .string()
        .min(20)
        .max(1000)
        .describe(
          'Resumo para o analista: quem, o quê, desde quando, o que já foi tentado, impacto, chamado',
        ),
    }),
    execute: async ({ reason, summary }) => {
      state.handoff = { reason, summary };
      return {
        accepted: true,
        note: 'Avise que um analista vai continuar por aqui. Não prometa horário além do prazo.',
      };
    },
  });

  const registerDecision = createTool({
    id: 'register_decision',
    description:
      'Registra o que você entendeu, a ação tomada, sua segurança (0 a 1) e o porquê. Chame exatamente uma vez, antes da resposta final.',
    inputSchema: z.object({
      intent: z.enum(AGENT_INTENTS),
      understoodSummary: z.string().min(3).max(300),
      entities: z.record(z.string(), z.string()).default({}),
      actionLabel: z
        .string()
        .min(3)
        .max(80)
        .describe('Ex.: "montou o rascunho", "respondeu com a central de ajuda"'),
      confidence: z.number().min(0).max(1),
      rationale: z.string().min(5).max(500),
      rulesApplied: z.array(z.string()).max(6).default([]),
    }),
    execute: async (input) => {
      state.decision = {
        intent: input.intent,
        understood: { summary: input.understoodSummary, entities: input.entities },
        action: { type: input.intent, label: input.actionLabel },
        confidence: { score: input.confidence, band: confidenceBand(input.confidence) },
        rationale: input.rationale,
        rulesApplied: input.rulesApplied.map((rule) =>
          rule.startsWith('Anexo A') ? rule : `Anexo A · ${rule}`,
        ),
        declaredByModel: true,
      };
      return { recorded: true };
    },
  });

  return {
    search_help_center: searchHelpCenter,
    list_my_tickets: listMyTickets,
    show_ticket_picker: showTicketPicker,
    get_my_ticket: getMyTicket,
    ask_quick_question: askQuickQuestion,
    draft_ticket: draftTicket,
    request_handoff: requestHandoff,
    register_decision: registerDecision,
  };
}
