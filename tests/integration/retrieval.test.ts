import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { VectorRepository } from '../../src/vector/repository.js';
import { MockEmbeddingProvider } from '../../src/vector/provider.js';
import { MockLlmProvider } from '../../src/query/llm.js';
import { RagRetrievalEngine } from '../../src/query/retrieval.js';
import { FALLBACK_RESPONSE } from '../../src/query/prompt.js';
import { query } from '../../src/database/pool.js';
import type { SseEvent } from '../../src/query/types.js';

describe('RagRetrievalEngine Integration (Task 3)', () => {
  const tenantId = `tenant_retrieval_${Date.now()}`;
  const vectorRepo = new VectorRepository();
  const mockEmbedding = new MockEmbeddingProvider(1536);
  const mockLlm = new MockLlmProvider('Yes, the Standing Desk Pro is currently in stock for $499.');
  const engine = new RagRetrievalEngine(vectorRepo, mockEmbedding, mockLlm);

  beforeAll(async () => {
    // Upsert a test record into pgvector
    const embedding = await mockEmbedding.generateEmbedding('Standing Desk Pro adjustable height');
    await vectorRepo.upsertVector({
      tenantId,
      sourceTable: 'products',
      sourceId: 'desk_99',
      content: 'Standing Desk Pro: Dual motor, adjustable height 28 to 48 inches. Price: $499. In Stock.',
      contentHash: 'hash_test_desk',
      embedding,
      metadata: { category: 'furniture' },
    });
  });

  afterAll(async () => {
    await query('DELETE FROM document_vectors WHERE tenant_id = $1;', [tenantId]);
  });

  it('retrieves relevant records, emits sources metadata, and streams tokens', async () => {
    const events: SseEvent[] = [];
    for await (const event of engine.execute({
      tenantId,
      message: 'Standing Desk Pro adjustable height',
      conversationId: 'conv_123',
    })) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThanOrEqual(3);

    // First event must be sources
    const sourcesEvent = events[0];
    expect(sourcesEvent.event).toBe('sources');
    if (sourcesEvent.event === 'sources') {
      expect(sourcesEvent.count).toBe(1);
      expect(sourcesEvent.tables).toContain('products');
    }

    // Intermediate events must be tokens
    const tokenEvents = events.filter((e) => e.event === 'token');
    expect(tokenEvents.length).toBeGreaterThan(0);
    const fullText = tokenEvents.map((t) => (t as any).delta).join('');
    expect(fullText).toContain('Standing Desk Pro');

    // Last event must be done
    const doneEvent = events[events.length - 1];
    expect(doneEvent.event).toBe('done');
    if (doneEvent.event === 'done') {
      expect(doneEvent.conversationId).toBe('conv_123');
    }
  });

  it('triggers fallback response when query does not pass similarity threshold', async () => {
    const events: SseEvent[] = [];
    for await (const event of engine.execute({
      tenantId,
      message: 'Completely unrelated query about interstellar astrophysics',
      similarityThreshold: 0.9999, // Impossible threshold
      conversationId: 'conv_fallback',
    })) {
      events.push(event);
    }

    const sourcesEvent = events[0];
    expect(sourcesEvent.event).toBe('sources');
    if (sourcesEvent.event === 'sources') {
      expect(sourcesEvent.count).toBe(0);
    }

    const tokenEvent = events.find((e) => e.event === 'token');
    expect(tokenEvent).toBeDefined();
    if (tokenEvent && tokenEvent.event === 'token') {
      expect(tokenEvent.delta).toBe(FALLBACK_RESPONSE);
    }
  });
});

