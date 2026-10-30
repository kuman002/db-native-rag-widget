import { VectorRepository } from '../vector/repository.js';
import { type EmbeddingProvider } from '../vector/provider.js';
import type { LlmProvider, RagQueryRequest, SseEvent, RetrievedChunk } from './types.js';
import {
  formatDatabaseContext,
  buildSystemPrompt,
  buildUserPrompt,
  DEFAULT_SIMILARITY_THRESHOLD,
  FALLBACK_RESPONSE,
} from './prompt.js';

export class RagRetrievalEngine {
  constructor(
    private readonly vectorRepo: VectorRepository,
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly llmProvider: LlmProvider
  ) {}

  /**
   * Orchestrates the RAG retrieval lifecycle and yields streaming SSE events.
   */
  async *execute(request: RagQueryRequest): AsyncIterable<SseEvent> {
    const conversationId = request.conversationId || `conv_${Date.now()}`;
    const queryText = request.message?.trim();

    if (!queryText) {
      yield { event: 'error', message: 'Query message cannot be empty' };
      yield { event: 'done', conversationId };
      return;
    }

    try {
      console.log(`[RAG Engine] Processing query: "${queryText}" (tenant: "${request.tenantId}", conversationId: "${conversationId}")`);

      // 1. Convert user inquiry to dense query embedding
      console.log(`[RAG Engine] Vectorizing user query with ${this.embeddingProvider.constructor.name}...`);
      const queryEmbedding = await this.embeddingProvider.generateEmbedding(queryText);
      console.log(`[RAG Engine] Generated query vector of dimension ${queryEmbedding.length}`);

      // 2. Perform cosine similarity vector search
      const threshold = request.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
      const topK = request.topK ?? 5;

      console.log(`[RAG Engine] Searching pgvector table document_vectors (tenant: "${request.tenantId}", minSimilarity: ${threshold}, topK: ${topK})...`);
      const similarRecords = await this.vectorRepo.findSimilar(
        request.tenantId,
        queryEmbedding,
        topK,
        threshold
      );

      console.log(`[RAG Engine] Found ${similarRecords.length} records meeting similarity threshold >= ${threshold}`);
      if (similarRecords.length > 0) {
        similarRecords.forEach((r, idx) => {
          console.log(`  └ [Record ${idx + 1}] table="${r.sourceTable}" id="${r.sourceId}" similarity=${r.similarity.toFixed(4)}`);
        });
      }

      // 3. Fallback check: if no verified records pass threshold, do not hallucinate
      if (!similarRecords || similarRecords.length === 0) {
        console.warn(`[RAG Engine] No verified records found in DB for tenant "${request.tenantId}". Returning anti-hallucination fallback.`);
        yield { event: 'sources', count: 0, tables: [] };
        yield { event: 'token', delta: FALLBACK_RESPONSE };
        yield { event: 'done', conversationId };
        return;
      }

      // 4. Emit sources metadata event
      const tables = Array.from(new Set(similarRecords.map((r) => r.sourceTable)));
      yield {
        event: 'sources',
        count: similarRecords.length,
        tables,
      };

      // 5. Build hallucination-resistant prompt
      const retrievedChunks: RetrievedChunk[] = similarRecords.map((r) => ({
        id: r.id,
        sourceTable: r.sourceTable,
        sourceId: r.sourceId,
        content: r.content,
        similarity: r.similarity,
        metadata: r.metadata,
      }));

      const contextString = formatDatabaseContext(retrievedChunks);
      const systemPrompt = buildSystemPrompt(contextString);
      const userPrompt = buildUserPrompt(queryText);

      console.log(`[RAG Engine] Invoking LLM (${this.llmProvider.constructor.name}) with ${retrievedChunks.length} verified context chunks...`);

      // 6. Stream tokens directly from the LLM provider
      let tokenCount = 0;
      for await (const token of this.llmProvider.generateStream(userPrompt, systemPrompt)) {
        if (token) {
          tokenCount++;
          yield { event: 'token', delta: token };
        }
      }

      console.log(`[RAG Engine] Completed streaming ${tokenCount} tokens for conversation ${conversationId}.`);

      // 7. Emit stream completion event
      yield { event: 'done', conversationId };
    } catch (err: any) {
      console.error(`[RAG Engine] Error occurred during retrieval/generation:`, err);
      yield { event: 'error', message: err?.message || 'Internal RAG retrieval error' };
      yield { event: 'done', conversationId };
    }
  }
}

