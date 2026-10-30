import { describe, it, expect } from 'vitest';
import {
  MockEmbeddingProvider,
  getEmbeddingProvider,
  type EmbeddingProvider,
} from '../../src/vector/provider.js';

describe('Pluggable Embedding Provider Abstraction (Task 1)', () => {
  it('MockEmbeddingProvider generates deterministic 1536-dimensional vectors', async () => {
    const provider: EmbeddingProvider = new MockEmbeddingProvider(1536);

    expect(provider.getDimensions()).toBe(1536);

    const vectorA1 = await provider.generateEmbedding('Ergonomic office chair');
    const vectorA2 = await provider.generateEmbedding('Ergonomic office chair');
    const vectorB = await provider.generateEmbedding('Wireless mechanical keyboard');

    // Dimensionality check
    expect(vectorA1).toHaveLength(1536);
    expect(vectorB).toHaveLength(1536);

    // Determinism: same input produces identical vector
    expect(vectorA1).toEqual(vectorA2);

    // Differentiation: different input produces different vector
    expect(vectorA1).not.toEqual(vectorB);

    // Normalization check: magnitude should be approximately 1.0 (unit vector)
    const norm = Math.sqrt(vectorA1.reduce((acc, val) => acc + val * val, 0));
    expect(norm).toBeCloseTo(1.0, 4);
  });

  it('MockEmbeddingProvider supports custom dimensions (e.g. 768)', async () => {
    const provider = new MockEmbeddingProvider(768);
    expect(provider.getDimensions()).toBe(768);

    const vector = await provider.generateEmbedding('Sample document');
    expect(vector).toHaveLength(768);
  });

  it('getEmbeddingProvider factory correctly instantiates providers', () => {
    const mockProvider = getEmbeddingProvider('mock');
    expect(mockProvider).toBeInstanceOf(MockEmbeddingProvider);
    expect(mockProvider.getDimensions()).toBe(1536);

    expect(() => getEmbeddingProvider('unsupported_provider')).toThrow(
      /Unsupported embedding provider/
    );
  });
});
