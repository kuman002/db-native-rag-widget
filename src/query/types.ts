export interface LlmStreamChunk {
  token: string;
  done: boolean;
}

export interface LlmProvider {
  /**
   * Generates a complete response for the given prompt.
   */
  generate(prompt: string, systemPrompt?: string): Promise<string>;

  /**
   * Streams token chunks for the given prompt.
   */
  generateStream(prompt: string, systemPrompt?: string): AsyncIterable<string>;
}

export interface RetrievedChunk {
  id: string;
  sourceTable: string;
  sourceId: string;
  content: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

export type SseEvent =
  | { event: 'sources'; count: number; tables: string[] }
  | { event: 'token'; delta: string }
  | { event: 'done'; conversationId: string }
  | { event: 'error'; message: string };

export interface RagQueryRequest {
  tenantId: string;
  message: string;
  conversationId?: string;
  similarityThreshold?: number;
  topK?: number;
}

