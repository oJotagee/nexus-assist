import { describe, expect, it } from 'bun:test';

import type { AgentTurnResult } from '@/application/ports/agent.port';
import type { EvalScenario } from '@tests/evals/scenarios';
import { CRITERIA, scoreScenario, summarizeByCriterion } from '@tests/evals/score';

function result(overrides: Partial<AgentTurnResult> = {}): AgentTurnResult {
  return {
    text: 'De segunda a sexta, das 8h às 18h.',
    blocks: [],
    steps: [
      {
        id: 's1',
        tool: 'help.search',
        label: 'buscou na central de ajuda',
        status: 'OK',
        attempts: 1,
        durationMs: 5,
      },
    ],
    decision: {
      intent: 'FAQ',
      understood: { summary: 'horário', entities: {} },
      action: { type: 'FAQ', label: 'respondeu' },
      confidence: { score: 0.95, band: 'HIGH' },
      rationale: 'Está na central.',
      rulesApplied: [],
      declaredByModel: true,
    },
    handoffRequest: null,
    draft: null,
    focusTicketId: null,
    usage: { model: 'x', inputTokens: 0, outputTokens: 0, latencyMs: 0 },
    ...overrides,
  };
}

const scenario = (expectations: EvalScenario['expect']): EvalScenario => ({
  id: 't',
  description: 't',
  userMessage: 'Qual o horário?',
  expect: expectations,
});

describe('scoreScenario', () => {
  it('aprova quando todos os critérios batem', () => {
    const score = scoreScenario(
      scenario({
        intent: 'FAQ',
        tools: ['help.search'],
        draft: null,
        handoff: null,
        textIncludes: ['8h'],
      }),
      result(),
      null,
    );

    expect(score.passed).toBe(true);
    expect([...score.evaluated].sort()).toEqual([...CRITERIA].sort());
  });

  it('reprova rascunho indevido numa dúvida', () => {
    const draft = { id: 'd', mode: 'CREATE', priority: 'LOW' } as AgentTurnResult['draft'];
    const score = scoreScenario(scenario({ draft: null }), result({ draft }), null);

    expect(score.failures).toEqual([
      { criterion: 'rascunho', detail: 'montou rascunho sem precisar' },
    ]);
  });

  it('compara cada campo esperado do rascunho', () => {
    const draft = {
      id: 'd',
      mode: 'CREATE',
      targetTicketId: null,
      priority: 'MEDIUM',
    } as AgentTurnResult['draft'];
    const score = scoreScenario(
      scenario({ draft: { mode: 'REOPEN', targetTicketId: 'INC-20150' } }),
      result({ draft }),
      null,
    );

    expect(score.failures.map((failure) => failure.detail)).toEqual([
      'mode = CREATE (esperado REOPEN)',
      'targetTicketId = null (esperado INC-20150)',
    ]);
  });

  it('usa a transferência final (depois da política), não só o pedido do modelo', () => {
    expect(scoreScenario(scenario({ handoff: 'CRITICAL' }), result(), null).passed).toBe(false);
    expect(scoreScenario(scenario({ handoff: 'CRITICAL' }), result(), 'CRITICAL').passed).toBe(
      true,
    );
  });

  it('ferramenta que falhou não conta como usada', () => {
    const steps = [
      {
        id: 's',
        tool: 'tickets.get',
        label: 'consultou',
        status: 'FAILED' as const,
        attempts: 4,
        durationMs: 9,
      },
    ];
    const score = scoreScenario(scenario({ tools: ['tickets.get'] }), result({ steps }), null);

    expect(score.failures[0]?.detail).toBe('não usou tickets.get');
  });

  it('blocos vazios esperados: card de chamado alheio é falha de privacidade', () => {
    const blocks = [
      { type: 'TICKET_CARD', ticket: { id: 'INC-20321' } },
    ] as AgentTurnResult['blocks'];
    const score = scoreScenario(scenario({ blocks: [] }), result({ blocks }), null);

    expect(score.failures[0]?.detail).toContain('TICKET_CARD');
  });

  it('texto proibido reprova (ex.: dizer que o chamado foi aberto antes de confirmar)', () => {
    const score = scoreScenario(
      scenario({ textExcludes: ['chamado criado'] }),
      result({ text: 'Pronto, chamado criado!' }),
      null,
    );
    expect(score.passed).toBe(false);
  });
});

describe('summarizeByCriterion', () => {
  it('conta acerto só entre os cenários que avaliam o critério', () => {
    const ok = scoreScenario(scenario({ intent: 'FAQ', handoff: null }), result(), null);
    const wrong = scoreScenario(scenario({ intent: 'TICKET_CREATE' }), result(), null);

    const summary = summarizeByCriterion([
      { scenario: scenario({}), score: ok, costUsd: 0, latencyMs: 0, declaredByModel: true },
      { scenario: scenario({}), score: wrong, costUsd: 0, latencyMs: 0, declaredByModel: true },
    ]);

    expect(summary.intenção).toEqual({ passed: 1, total: 2 });
    expect(summary.transferência).toEqual({ passed: 1, total: 1 });
    expect(summary.rascunho).toEqual({ passed: 0, total: 0 });
  });
});
