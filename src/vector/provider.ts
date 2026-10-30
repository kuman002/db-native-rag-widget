import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import { env } from '../config/env.js';

export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
  getDimensions(): number;
}

/**
 * Mock embedding provider producing deterministic, normalized float vectors for testing.
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly dimensions: number = env.VECTOR_DIMENSION || 1536) {}

  async generateEmbedding(text: string): Promise<number[]> {
    // Generate deterministic seed numbers from text hash
    const hash = createHash('sha256').update(text).digest();
    const vector: number[] = new Array(this.dimensions);

    let sumSquares = 0;
    for (let i = 0; i < this.dimensions; i++) {
      // Pick bytes from hash circularly and generate float in range [-1, 1]
      const byte1 = hash[i % hash.length];
      const byte2 = hash[(i + 1) % hash.length];
      const rawVal = ((byte1 << 8) | byte2) / 32767.5 - 1.0;
      vector[i] = rawVal;
      sumSquares += rawVal * rawVal;
    }

    // Normalize to unit vector
    const norm = Math.sqrt(sumSquares);
    for (let i = 0; i < this.dimensions; i++) {
      vector[i] = vector[i] / norm;
    }

    return vector;
  }

  getDimensions(): number {
    return this.dimensions;
  }
}

/**
 * Cloud embedding provider using OpenAI text-embedding-3-small (1536 dimensions).
 */
export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  private client: OpenAI;

  constructor(
    apiKey: string = process.env.OPENAI_API_KEY || '',
    private readonly model: string = 'text-embedding-3-small'
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });
    return response.data[0].embedding;
  }

  getDimensions(): number {
    return 1536;
  }
}

/**
 * Local zero-cost embedding provider using Ollama.
 */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly baseUrl: string = process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    private readonly model: string = 'nomic-embed-text',
    private readonly dimensions: number = 768
  ) {}

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama embedding request failed with status ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as { embedding: number[] };
    return data.embedding;
  }

  getDimensions(): number {
    return this.dimensions;
  }
}

/**
 * Factory to instantiate the configured embedding provider.
 */
export function getEmbeddingProvider(type?: string): EmbeddingProvider {
  const selectedType = (
    type ||
    process.env.EMBEDDING_PROVIDER ||
    (env.NODE_ENV === 'test' ? 'mock' : 'openai')
  ).toLowerCase();

  switch (selectedType) {
    case 'mock':
      return new MockEmbeddingProvider(env.VECTOR_DIMENSION || 1536);
    case 'openai':
      return new OpenAiEmbeddingProvider();
    case 'ollama':
      return new OllamaEmbeddingProvider();
    default:
      throw new Error(`Unsupported embedding provider: '${selectedType}'. Supported: 'mock', 'openai', 'ollama'.`);
  }
}
