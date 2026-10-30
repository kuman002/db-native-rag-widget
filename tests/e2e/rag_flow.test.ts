import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createServer } from '../../src/api/server.js';
import { RagRetrievalEngine } from '../../src/query/retrieval.js';
import { VectorRepository } from '../../src/vector/repository.js';
import { MockEmbeddingProvider, OllamaEmbeddingProvider } from '../../src/vector/provider.js';
import { MockLlmProvider } from '../../src/query/llm.js';
import { query } from '../../src/database/pool.js';

describe('End-to-End RAG Lifecycle Verification (Task 5)', () => {
  let server: Server;
  const port = 3457;
  const baseUrl = `http://127.0.0.1:${port}`;
  const tenantId = `tenant_e2e_${Date.now()}`;

  const vectorRepo = new VectorRepository();
  const embeddingProvider = new OllamaEmbeddingProvider('http://localhost:11434', 'nomic-embed-text', 1536);
  const llmProvider = new MockLlmProvider('The UltraLight Carbon Bike weighs only 7.2kg and is priced at $1,299.');
  const engine = new RagRetrievalEngine(vectorRepo, embeddingProvider, llmProvider);

  beforeAll(async () => {
    // 1. Generate real vector embedding via Ollama
    const embedding = await embeddingProvider.generateEmbedding(
      'UltraLight Carbon Road Bike 7.2kg Shimano 105 Di2 groupset'
    );

    // 2. Index record into PostgreSQL pgvector
    await vectorRepo.upsertVector({
      tenantId,
      sourceTable: 'products',
      sourceId: 'bike_e2e_01',
      content: 'Product: UltraLight Carbon Road Bike. Weight: 7.2kg. Groupset: Shimano 105 Di2. Price: $1,299.',
      contentHash: 'hash_e2e_bike',
      embedding,
      metadata: { sku: 'BIKE-CARBON-01' },
    });

    server = createServer({ retrievalEngine: engine });
    await new Promise<void>((resolve) => server.listen(port, resolve));
  });

  afterAll(async () => {
    await query('DELETE FROM document_vectors WHERE tenant_id = $1;', [tenantId]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('conducts vector search in pgvector and streams synthesized answer over SSE', async () => {
    const res = await fetch(`${baseUrl}/api/v1/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Key': tenantId,
      },
      body: JSON.stringify({
        message: 'What is the weight and price of the carbon road bike?',
        conversationId: 'conv_e2e_verified',
      }),
    });

    expect(res.status).toBe(200);
    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    let streamOutput = '';

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      streamOutput += decoder.decode(value, { stream: true });
    }

    // Verify SSE structure
    expect(streamOutput).toContain('event":"sources"');
    expect(streamOutput).toContain('count":1');
    expect(streamOutput).toContain('products');
    expect(streamOutput).toContain('event":"token"');
    expect(streamOutput).toContain('event":"done"');
    expect(streamOutput).toContain('conv_e2e_verified');

    // Parse accumulated tokens
    const lines = streamOutput.split('\n');
    const tokens = lines
      .filter((l) => l.startsWith('data: {"event":"token"'))
      .map((l) => JSON.parse(l.replace('data: ', '')).delta)
      .join('');

    expect(tokens).toContain('UltraLight Carbon Bike');
    expect(tokens).toContain('7.2kg');
    expect(tokens).toContain('$1,299');
  });
});
