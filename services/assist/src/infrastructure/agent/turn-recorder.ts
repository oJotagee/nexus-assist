import type { MessageBlock, TraceStep } from '@nexo/shared';

import { TicketsUnavailableError } from '@/domain/errors/domain.error';
import type { AgentTurnSink } from '@/application/ports/agent.port';

export type StepOutcome<T> = { result: T; attempts?: number; summary: string };

/**
 * Instrumenta cada tool: emite o passo em tempo real (vira o "consultou seus chamados ✓" acima
 * da resposta), mede duração e tentativas, e guarda tudo para o trace persistido.
 */
export class TurnRecorder {
  readonly steps: TraceStep[] = [];
  readonly blocks: MessageBlock[] = [];
  private counter = 0;

  constructor(private readonly sink: AgentTurnSink) {}

  async step<T>(
    tool: string,
    label: string,
    input: unknown,
    run: () => Promise<StepOutcome<T>>,
  ): Promise<T | { error: string }> {
    const id = `step-${++this.counter}`;
    const started = Date.now();
    this.sink.step({ id, tool, label, status: 'RUNNING', attempts: 0, durationMs: 0 });

    try {
      const outcome = await run();
      const attempts = outcome.attempts ?? 1;
      this.finish({
        id,
        tool,
        label,
        status: attempts > 1 ? 'RETRIED' : 'OK',
        attempts,
        durationMs: Date.now() - started,
        input,
        outputSummary: outcome.summary,
      });
      return outcome.result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha inesperada ao executar a ferramenta.';
      this.finish({
        id,
        tool,
        label,
        status: 'FAILED',
        attempts: error instanceof TicketsUnavailableError ? 4 : 1,
        durationMs: Date.now() - started,
        input,
        outputSummary: message,
      });
      return { error: message };
    }
  }

  /** Passo instantâneo, calculado em código (ex.: "classificou a prioridade"). */
  note(tool: string, label: string, summary: string, input?: unknown): void {
    this.finish({
      id: `step-${++this.counter}`,
      tool,
      label,
      status: 'OK',
      attempts: 1,
      durationMs: 0,
      input,
      outputSummary: summary,
    });
  }

  block(block: MessageBlock): void {
    const index = this.blocks.findIndex((existing) => existing.type === block.type);
    if (index >= 0) this.blocks.splice(index, 1, block);
    else this.blocks.push(block);
    this.sink.block(block);
  }

  private finish(step: TraceStep): void {
    this.steps.push(step);
    const { input: _input, ...visible } = step;
    this.sink.step(visible);
  }
}
