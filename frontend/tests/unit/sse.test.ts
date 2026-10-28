import { describe, expect, it } from 'bun:test';

import { parseSseChunk, readAgentStream } from '../../src/lib/sse';

const encoder = new TextEncoder();

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe('parseSseChunk', () => {
  it('separa eventos completos e guarda o resto', () => {
    const { events, rest } = parseSseChunk(
      'data: {"type":"text-delta","delta":"Olá"}\n\ndata: {"type":"text-de',
    );

    expect(events).toEqual([{ type: 'text-delta', delta: 'Olá' }]);
    expect(rest).toBe('data: {"type":"text-de');
  });

  it('ignora evento malformado sem derrubar os outros', () => {
    const { events } = parseSseChunk(
      'data: {quebrado\n\ndata: {"type":"text-delta","delta":"ok"}\n\n',
    );
    expect(events).toEqual([{ type: 'text-delta', delta: 'ok' }]);
  });
});

describe('readAgentStream', () => {
  it('remonta eventos quebrados entre pacotes da rede', async () => {
    const received: unknown[] = [];

    await readAgentStream(
      streamOf([
        'data: {"type":"step","step":{"id":"s1","to',
        'ol":"tickets.list"}}\n\nda',
        'ta: {"type":"text-delta","delta":"pronto"}\n\n',
      ]),
      (event) => received.push(event),
    );

    expect(received).toEqual([
      { type: 'step', step: { id: 's1', tool: 'tickets.list' } },
      { type: 'text-delta', delta: 'pronto' },
    ]);
  });
});
