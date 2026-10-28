import type { HandoffReason } from '@nexo/shared';

import type { AgentTurnResult } from '@/application/ports/agent.port';
import type { EvalScenario } from './scenarios';

/** Critérios avaliados, na ordem do relatório (alinhados aos critérios do desafio). */
export const CRITERIA = ['intenção', 'ferramentas', 'rascunho', 'transferência', 'texto'] as const;
export type Criterion = (typeof CRITERIA)[number];

export type ScenarioScore = {
  passed: boolean;
  failures: { criterion: Criterion; detail: string }[];
  /** Critérios que o cenário de fato avalia (os outros não contam no total). */
  evaluated: Criterion[];
};

/**
 * Pontua um turno do agent contra o gabarito do cenário. Função pura e objetiva (sem LLM-juiz),
 * para o resultado ser reprodutível e a própria régua ter testes.
 */
export function scoreScenario(
  scenario: EvalScenario,
  result: Pick<AgentTurnResult, 'text' | 'blocks' | 'steps' | 'decision' | 'draft'>,
  handoff: HandoffReason | null,
): ScenarioScore {
  const expect = scenario.expect;
  const failures: ScenarioScore['failures'] = [];
  const evaluated = new Set<Criterion>();
  const tools = new Set(
    result.steps.filter((step) => step.status !== 'FAILED').map((step) => step.tool),
  );
  const intent = handoff ? 'HANDOFF' : result.decision.intent;

  if (expect.intent) {
    evaluated.add('intenção');
    const allowed = Array.isArray(expect.intent) ? expect.intent : [expect.intent];
    if (!allowed.includes(intent) && !allowed.includes(result.decision.intent)) {
      failures.push({
        criterion: 'intenção',
        detail: `${intent} (esperado ${allowed.join(' | ')})`,
      });
    }
  }

  if (expect.tools || expect.forbiddenTools || expect.blocks) {
    evaluated.add('ferramentas');
    for (const tool of expect.tools ?? []) {
      if (!tools.has(tool)) failures.push({ criterion: 'ferramentas', detail: `não usou ${tool}` });
    }
    for (const tool of expect.forbiddenTools ?? []) {
      if (tools.has(tool))
        failures.push({ criterion: 'ferramentas', detail: `usou ${tool} indevidamente` });
    }
    const blockTypes = result.blocks.map((block) => block.type);
    for (const block of expect.blocks ?? []) {
      if (!blockTypes.includes(block))
        failures.push({ criterion: 'ferramentas', detail: `não mostrou ${block}` });
    }
    if (expect.blocks?.length === 0) {
      const unexpected = blockTypes.filter((type) => type !== 'QUICK_REPLIES');
      if (unexpected.length) {
        failures.push({
          criterion: 'ferramentas',
          detail: `mostrou ${unexpected.join(', ')} indevidamente`,
        });
      }
    }
  }

  if (expect.draft !== undefined) {
    evaluated.add('rascunho');
    if (expect.draft === null && result.draft) {
      failures.push({ criterion: 'rascunho', detail: 'montou rascunho sem precisar' });
    }
    if (expect.draft) {
      if (!result.draft) {
        failures.push({ criterion: 'rascunho', detail: 'não montou o rascunho' });
      } else {
        for (const [key, value] of Object.entries(expect.draft)) {
          const actual = result.draft[key as keyof typeof result.draft];
          if (actual !== value) {
            failures.push({
              criterion: 'rascunho',
              detail: `${key} = ${String(actual)} (esperado ${String(value)})`,
            });
          }
        }
      }
    }
  }

  if (expect.handoff !== undefined) {
    evaluated.add('transferência');
    if (handoff !== expect.handoff) {
      failures.push({
        criterion: 'transferência',
        detail: `${handoff ?? 'nenhuma'} (esperado ${expect.handoff ?? 'nenhuma'})`,
      });
    }
  }

  if (expect.textIncludes || expect.textExcludes) {
    evaluated.add('texto');
    const text = result.text.toLowerCase();
    for (const piece of expect.textIncludes ?? []) {
      if (!text.includes(piece.toLowerCase()))
        failures.push({ criterion: 'texto', detail: `não menciona "${piece}"` });
    }
    for (const piece of expect.textExcludes ?? []) {
      if (text.includes(piece.toLowerCase()))
        failures.push({ criterion: 'texto', detail: `menciona "${piece}"` });
    }
  }

  return { passed: failures.length === 0, failures, evaluated: [...evaluated] };
}

export type ScenarioRun = {
  scenario: EvalScenario;
  score: ScenarioScore | null;
  error?: string;
  costUsd: number;
  latencyMs: number;
  declaredByModel: boolean;
};

/** Acerto por critério: quantos cenários que avaliam o critério passaram nele. */
export function summarizeByCriterion(
  runs: ScenarioRun[],
): Record<Criterion, { passed: number; total: number }> {
  const summary = Object.fromEntries(
    CRITERIA.map((criterion) => [criterion, { passed: 0, total: 0 }]),
  ) as Record<Criterion, { passed: number; total: number }>;

  for (const run of runs) {
    if (!run.score) continue;
    for (const criterion of run.score.evaluated) {
      summary[criterion].total += 1;
      if (!run.score.failures.some((failure) => failure.criterion === criterion))
        summary[criterion].passed += 1;
    }
  }

  return summary;
}
