import type { AgentStreamEvent } from '@nexo/shared';

/**
 * Lê um stream SSE (`data: {...}\n\n`) e entrega cada evento já parseado.
 * Tolera eventos quebrados entre chunks da rede.
 */
export async function readAgentStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: AgentStreamEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = parseSseChunk(buffer);
    buffer = rest;
    for (const event of events) onEvent(event);
  }

  const { events } = parseSseChunk(`${buffer}\n\n`);
  for (const event of events) onEvent(event);
}

export function parseSseChunk(buffer: string): { events: AgentStreamEvent[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const events: AgentStreamEvent[] = [];

  for (const part of parts) {
    const data = part
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data) continue;

    try {
      events.push(JSON.parse(data) as AgentStreamEvent);
    } catch {}
  }

  return { events, rest };
}
