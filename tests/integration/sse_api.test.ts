import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createServer } from '../../src/api/server.js';
import { RagRetrievalEngine } from '../../src/query/retrieval.js';
import { VectorRepository } from '../../src/vector/repository.js';
import { MockEmbeddingProvider } from '../../src/vector/provider.js';
import { MockLlmProvider } from '../../src/query/llm.js';
import { query } from '../../src/database/pool.js';

describe('Streaming SSE HTTP Gateway (Task 4)', () => {
  let server: Server;
  const port = 3456;
  const baseUrl = `http://127.0.0.1:${port}`;
  const tenantId = `tenant_api_${Date.now()}`;

  const vectorRepo = new VectorRepository();
  const mockEmbedding = new MockEmbeddingProvider(1536);
  const mockLlm = new MockLlmProvider('Our wireless headphones feature active noise cancellation.');
  const retrievalEngine = new RagRetrievalEngine(vectorRepo, mockEmbedding, mockLlm);

  beforeAll(async () => {
    // Seed a vector record
    const embedding = await mockEmbedding.generateEmbedding('wireless headphones active noise cancelling');
    await vectorRepo.upsertVector({
      tenantId,
      sourceTable: 'products',
      sourceId: 'prod_anc_1',
      content: 'Product: ANC Headphones. Feature: Active Noise Cancellation. Battery: 30 hours.',
      contentHash: 'hash_anc_1',
      embedding,
    });

    server = createServer({ retrievalEngine });
    await new Promise<void>((resolve) => server.listen(port, resolve));
  });

  afterAll(async () => {
    await query('DELETE FROM document_vectors WHERE tenant_id = $1;', [tenantId]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /health returns 200 with connected statuses', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.status).toBe('healthy');
    expect(data.postgres.connected).toBe(true);
    expect(data.redis.connected).toBe(true);
  });

  it('OPTIONS /api/v1/chat/message handles CORS preflight', async () => {
    const res = await fetch(`${baseUrl}/api/v1/chat/message`, {
      method: 'OPTIONS',
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('POST /api/v1/chat/message returns 400 for empty payload', async () => {
    const res = await fetch(`${baseUrl}/api/v1/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toContain('Field "message" is required');
  });

  it('POST /api/v1/chat/message streams real-time SSE events', async () => {
    const res = await fetch(`${baseUrl}/api/v1/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Key': tenantId,
      },
      body: JSON.stringify({
        message: 'wireless headphones active noise cancelling',
        conversationId: 'conv_sse_test',
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    let streamText = '';

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      streamText += decoder.decode(value, { stream: true });
    }

    expect(streamText).toContain('event":"sources');
    expect(streamText).toContain('event":"token');
    expect(streamText).toContain('cancellation');
    expect(streamText).toContain('event":"done');
    expect(streamText).toContain('conv_sse_test');
  });
});
