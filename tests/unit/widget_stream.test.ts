import { describe, it, expect, vi } from 'vitest';
import { fetchSseStream } from '../../src/widget/stream.js';
import type { SseEvent } from '../../src/query/types.js';

describe('Widget SSE Stream Parser (Task 1)', () => {
  it('parses split chunks and emits structured events', async () => {
    const rawChunks = [
      'data: {"event":"sources","count":1,"tables":["pro',
      'ducts"]}\n\ndata: {"event":"token","del',
      'ta":"Hello"}\n\ndata: {"event":"done","conversationId":"conv_99"}\n\n',
    ];

    let chunkIndex = 0;
    const mockStream = new ReadableStream({
      pull(controller) {
        if (chunkIndex < rawChunks.length) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(rawChunks[chunkIndex++]));
        } else {
          controller.close();
        }
      },
    });

    vi.stubGlobal('fetch', async () => ({
      ok: true,
      body: mockStream,
    }));

    const events: SseEvent[] = [];
    let completed = false;

    await fetchSseStream({
      url: 'http://test/chat',
      tenantKey: 'tnt_test',
      message: 'test query',
      onEvent: (ev) => events.push(ev),
      onComplete: () => {
        completed = true;
      },
    });

    expect(events.length).toBe(3);
    expect(events[0]).toEqual({ event: 'sources', count: 1, tables: ['products'] });
    expect(events[1]).toEqual({ event: 'token', delta: 'Hello' });
    expect(events[2]).toEqual({ event: 'done', conversationId: 'conv_99' });
    expect(completed).toBe(true);

    vi.unstubAllGlobals();
  });
});

